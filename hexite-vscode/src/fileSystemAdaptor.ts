import type fs from "fs";
import * as vscode from "vscode";

declare function require(_name: "fs"): typeof fs;

export interface FileAccessor {
  readonly uri: string;
  /**
   * Whether this accessor works with the file incrementally under the hood.
   * If false, it may be necessary to warn the user before they open very large files.
   */
  readonly supportsIncremetalAccess?: boolean;

  /** Implements a file watcher. */
  watch(onDidChange: () => void, onDidDelete: () => void): vscode.Disposable;
  /** Calculates the size of the associated document. Undefined if unbounded */
  getSize(): Promise<number | undefined>;
  /** Reads bytes at the given offset from the file, returning the number of read bytes. */
  read(offset: number, target: Uint8Array): Promise<number>;
  /** Signalled when a full reload is requested. Cached data should be forgotten. */
  invalidate?(): void;
  /** Disposes of the accessor. */
  dispose(): void;
}

export const accessFile = async (
  uri: vscode.Uri,
  untitledDocumentData?: Uint8Array
): Promise<FileAccessor> => {
  if (uri.scheme === "untitled") {
    return new UntitledFileAccessor(
      uri,
      untitledDocumentData ?? new Uint8Array()
    );
  }

  if (uri.scheme === "vscode-debug-memory") {
    const { permissions = 0 } = await vscode.workspace.fs.stat(uri);
    return new DebugFileAccessor(
      uri,
      !!(permissions & vscode.FilePermission.Readonly)
    );
  }

  // try to use native file access for local files to allow large files to be handled efficiently
  // todo@connor4312/lramos: push forward extension host API for this.
  if (uri.scheme === "file") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      if ((await fs.promises.stat(uri.fsPath)).isFile()) {
        return new NativeFileAccessor(uri, fs);
      }
    } catch {
      // probably not node.js, or file does not exist
    }
  }

  return new SimpleFileAccessor(uri);
};

class FileHandleContainer {
  private borrowQueue: ((
    h: fs.promises.FileHandle | Error
  ) => Promise<void>)[] = [];
  private handle?: fs.promises.FileHandle;
  private disposeTimeout?: NodeJS.Timeout;
  private disposed = false;

  constructor(public readonly path: string, private readonly _fs: typeof fs) {}

  /** Borrows the file handle to run the function. */
  public borrow<R>(fn: (handle: fs.promises.FileHandle) => R): Promise<R> {
    if (this.disposed) {
      return Promise.reject(new Error("FileHandle was disposed"));
    }

    return new Promise<R>((resolve, reject) => {
      this.borrowQueue.push(async (handle) => {
        if (handle instanceof Error) {
          return reject(handle);
        }

        try {
          resolve(await fn(handle));
        } catch (e) {
          reject(e);
        }
      });

      if (this.borrowQueue.length === 1) {
        this.process();
      }
    });
  }

  public dispose() {
    this.disposed = true;
    this.handle = undefined;
    if (this.disposeTimeout) {
      clearTimeout(this.disposeTimeout);
    }
    this.rejectAll(new Error("FileHandle was disposed"));
  }

  /* Closes the handle, but allows it to be reopened if another borrow happens */
  public async close() {
    await this.handle?.close();
    this.handle = undefined;
    if (this.disposeTimeout) {
      clearTimeout(this.disposeTimeout);
    }
  }

  private rejectAll(error: Error) {
    while (this.borrowQueue.length) {
      this.borrowQueue.pop()!(error);
    }
  }

  private async process() {
    if (this.disposeTimeout) {
      clearTimeout(this.disposeTimeout);
    }

    while (this.borrowQueue.length) {
      if (!this.handle) {
        try {
          this.handle = await this._fs.promises.open(
            this.path,
            this._fs.constants.O_RDWR | this._fs.constants.O_CREAT
          );
        } catch (e) {
          return this.rejectAll(e as Error);
        }
      }

      await this.borrowQueue[0]?.(this.handle);
      this.borrowQueue.shift();
    }

    // When no one is using the handle, close it after some time. Otherwise the
    // filesystem will lock the file which would be frustrating to users.
    if (this.handle) {
      this.disposeTimeout = setTimeout(() => {
        this.handle?.close();
        this.handle = undefined;
      }, 1000);
    }
  }
}

/** Native accessor using Node's filesystem. This can be used. */
class NativeFileAccessor implements FileAccessor {
  public readonly uri: string;
  public readonly supportsIncremetalAccess = true;
  private readonly handle: FileHandleContainer;

  constructor(uri: vscode.Uri, private readonly fs: typeof import("fs")) {
    this.uri = uri.toString();
    this.handle = new FileHandleContainer(uri.fsPath, fs);
  }

  watch(onDidChange: () => void, onDidDelete: () => void): vscode.Disposable {
    return watchWorkspaceFile(this.uri, onDidChange, onDidDelete);
  }

  async getSize(): Promise<number | undefined> {
    return this.handle.borrow(async (fd) => (await fd.stat()).size);
  }

  async read(offset: number, target: Uint8Array): Promise<number> {
    return this.handle.borrow(async (fd) => {
      const { bytesRead } = await fd.read(target, 0, target.byteLength, offset);
      return bytesRead;
    });
  }

  public dispose() {
    this.handle.dispose();
  }
}

class SimpleFileAccessor implements FileAccessor {
  protected contents?: Thenable<Uint8Array> | Uint8Array;
  private readonly fsPath: string;
  public readonly uri: string;

  constructor(uri: vscode.Uri) {
    this.uri = uri.toString();
    this.fsPath = uri.fsPath;
  }

  watch(onDidChange: () => void, onDidDelete: () => void): vscode.Disposable {
    return watchWorkspaceFile(this.uri, onDidChange, onDidDelete);
  }

  async getSize(): Promise<number> {
    return (await vscode.workspace.fs.stat(vscode.Uri.parse(this.uri))).size;
  }

  async read(offset: number, data: Uint8Array): Promise<number> {
    const contents = await this.getContents();
    const cpy = Math.min(data.length, contents.length - offset);
    data.set(contents.subarray(offset, cpy + offset));
    return cpy;
  }

  public invalidate(): void {
    this.contents = undefined;
  }

  dispose() {
    this.contents = undefined;
  }

  private getContents() {
    this.contents ??= vscode.workspace.fs.readFile(vscode.Uri.parse(this.uri));
    return this.contents;
  }
}

class UntitledFileAccessor extends SimpleFileAccessor {
  protected override contents: Uint8Array;

  constructor(uri: vscode.Uri, untitledContents: Uint8Array) {
    super(uri);
    this.contents = untitledContents;
  }

  public override getSize() {
    return Promise.resolve(this.contents.byteLength);
  }
}

const watchWorkspaceFile = (
  uri: string,
  onDidChange: () => void,
  onDidDelete: () => void
) => {
  const base = uri.split("/");
  const fileName = base.pop()!;
  const pattern = new vscode.RelativePattern(
    vscode.Uri.parse(base.join("/")),
    fileName
  );

  const watcher = vscode.workspace.createFileSystemWatcher(pattern);
  watcher.onDidChange(onDidChange);
  watcher.onDidDelete(onDidDelete);
  return watcher;
};

/**
 * File accessor for VS Code debug memory. This is special-cased since we don't
 * yet have low level filesystem operations in the extension host API.
 *
 * !!! DO NOT COPY THIS CODE. This way of accessing debug memory is subject to
 * change in the future. Your extension will break if you copy this code. !!!
 */
class DebugFileAccessor implements FileAccessor {
  public readonly supportsIncremetalAccess = true;
  public readonly uri: string;

  constructor(uri: vscode.Uri, public readonly isReadonly: boolean) {
    this.uri = uri.toString();
  }

  watch(onDidChange: () => void, onDidDelete: () => void): vscode.Disposable {
    return watchWorkspaceFile(this.uri, onDidChange, onDidDelete);
  }

  async getSize(): Promise<number | undefined> {
    return undefined;
  }

  async read(offset: number, data: Uint8Array): Promise<number> {
    const contents = await vscode.workspace.fs.readFile(
      this.referenceRange(offset, offset + data.length)
    );

    const cpy = Math.min(data.length, contents.length - offset);
    data.set(contents.subarray(offset, cpy + offset));
    return cpy;
  }

  private referenceRange(from: number, to: number) {
    return vscode.Uri.parse(this.uri).with({ query: `?range=${from}:${to}` });
  }

  public invalidate(): void {
    // no-op
  }

  dispose() {
    // no-op
  }
}
