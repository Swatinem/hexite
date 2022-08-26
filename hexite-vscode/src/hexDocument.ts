import * as vscode from "vscode";
import { Disposable } from "./dispose";
import { FileAccessor, accessFile } from "./fileSystemAdaptor";

export class HexDocument extends Disposable implements vscode.CustomDocument {
  static async create(
    uri: vscode.Uri,
    { untitledDocumentData }: vscode.CustomDocumentOpenContext
  ): Promise<{ document: HexDocument; accessor: FileAccessor }> {
    const accessor = await accessFile(uri, untitledDocumentData);

    const queries = HexDocument.parseQuery(uri.query);
    const baseAddress: number = queries["baseAddress"]
      ? HexDocument.parseHexOrDecInt(queries["baseAddress"])
      : 0;

    return {
      document: new HexDocument(accessor, baseAddress),
      accessor,
    };
  }

  constructor(
    private accessor: FileAccessor,
    public readonly baseAddress: number
  ) {
    super();
  }

  /** @inheritdoc */
  public get uri(): vscode.Uri {
    return vscode.Uri.parse(this.accessor.uri);
  }

  /**
   * Reads into the buffer from the original file, without edits.
   */
  public async readBuffer(offset: number, length: number): Promise<Uint8Array> {
    const target = new Uint8Array(length);
    const read = await this.accessor.read(offset, target);
    return read === length ? target : target.slice(0, read);
  }

  private readonly _onDidDispose = this._register(
    new vscode.EventEmitter<void>()
  );
  /*
		Fires when the document is disposed of
	*/
  public readonly onDidDispose = this._onDidDispose.event;

  dispose(): void {
    // Notify subsribers to the custom document we are disposing of it
    this._onDidDispose.fire();
    this.accessor.dispose();
    // Disposes of all the events attached to the custom document
    super.dispose();
  }

  private readonly _onDidRevert = this._register(
    new vscode.EventEmitter<void>()
  );

  /**
   * Fired to notify webviews that the document has changed and the file
   * should be reloaded.
   */
  public readonly onDidRevert = this._onDidRevert.event;

  /**
   * See {@link HexDocumentModel.size}
   */
  public size(): Promise<number | undefined> {
    return this.accessor.getSize();
  }

  /**
   * Called by VS Code when the user calls `revert` on a document.
   */
  async revert(_token?: vscode.CancellationToken): Promise<void> {
    this.accessor.invalidate?.();
    this._onDidRevert.fire();
  }

  /**
   * Utility function to convert a Uri query string into a map
   */
  private static parseQuery(queryString: string): { [key: string]: string } {
    const queries: { [key: string]: string } = {};
    if (queryString) {
      const pairs = (
        queryString[0] === "?" ? queryString.substr(1) : queryString
      ).split("&");
      for (const q of pairs) {
        const pair = q.split("=");
        const name = pair.shift();
        if (name) {
          queries[name] = pair.join("=");
        }
      }
    }
    return queries;
  }

  /**
   * Utility function to parse a number. Only hex and decimal supported
   */
  private static parseHexOrDecInt(str: string): number {
    str = str.toLowerCase();
    return str.startsWith("0x")
      ? parseInt(str.substring(2), 16)
      : parseInt(str, 10);
  }
}
