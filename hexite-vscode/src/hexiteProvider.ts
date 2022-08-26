import * as vscode from "vscode";
import { disposeAll } from "./dispose";
import { HexDocument } from "./hexDocument";
import {
  ExtensionHostMessageHandler,
  FromWebviewMessage,
  MessageHandler,
  MessageType,
  ToWebviewMessage,
} from "./protocol";
import { getCorrectArrayBuffer, randomString } from "./util";
import { WebviewCollection } from "./webViewCollection";

export class HexiteProvider
  implements vscode.CustomReadonlyEditorProvider<HexDocument>
{
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      HexiteProvider.viewType,
      new HexiteProvider(context),
      {
        supportsMultipleEditorsPerDocument: true,
      }
    );
  }

  private static readonly viewType = "hexite.hexview";

  private readonly webviews = new WebviewCollection();

  constructor(private readonly _context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<HexDocument> {
    const { document, accessor } = await HexDocument.create(uri, openContext);
    const disposables: vscode.Disposable[] = [];

    disposables.push(
      document.onDidRevert(() => {
        for (const { messaging } of this.webviews.get(document.uri)) {
          messaging.sendEvent({ type: MessageType.ReloadFromDisk });
        }
      })
    );

    const onDidChange = async () => {
      document.revert();
    };

    const onDidDelete = () => {
      vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    };

    disposables.push(accessor.watch(onDidChange, onDidDelete));

    document.onDidDispose(() => {
      disposeAll(disposables);
    });

    return document;
  }

  async resolveCustomEditor(
    document: HexDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const messageHandler: ExtensionHostMessageHandler = new MessageHandler(
      (message) => this.onMessage(messageHandler, document, message),
      (message) => webviewPanel.webview.postMessage(message)
    );

    // Add the webview to our internal set of active webviews
    this.webviews.add(document.uri, messageHandler, webviewPanel);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage((e) =>
      messageHandler.handleMessage(e)
    );
  }

  /**
   * Get the static HTML used for in our editor's webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Convert the styles and scripts for the webview into webview URIs
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "dist", "viewer.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "dist", "viewer.css")
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = randomString();

    return /* html */ `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleUri}" rel="stylesheet" />
				<script nonce="${nonce}" src="${scriptUri}" defer></script>

				<title>Hexite</title>
			</head>
			<body>
			</body>
			</html>`;
  }

  private async onMessage(
    messaging: ExtensionHostMessageHandler,
    document: HexDocument,
    message: FromWebviewMessage
  ): Promise<undefined | ToWebviewMessage> {
    switch (message.type) {
      // If it's a packet request
      case MessageType.ReadyRequest:
        return {
          type: MessageType.ReadyResponse,
          initialOffset: document.baseAddress,
          fileSize: await document.size(),
        };
      case MessageType.ReadRangeRequest:
        const data = await document.readBuffer(message.offset, message.bytes);
        return {
          type: MessageType.ReadRangeResponse,
          data: getCorrectArrayBuffer(data),
        };
      /*case MessageType.DoCopy: {
        const parts = await Promise.all(
          message.selections
            .sort((a, b) => a[0] - b[0])
            .map((s) => document.readBuffer(s[0], s[1] - s[0]))
        );
        const flatParts = flattenBuffers(parts);
        const encoded = message.asText
          ? new TextDecoder().decode(flatParts)
          : base64.fromUint8Array(flatParts);
        vscode.env.clipboard.writeText(encoded);
        return;
      }*/
    }
  }
}
