import * as vscode from "vscode";
import { HexiteProvider } from "./hexiteProvider";

export function activate(context: vscode.ExtensionContext) {
  const openWithCommand = vscode.commands.registerCommand(
    "hexEditor.openFile",
    () => {
      const activeTabInput = vscode.window.tabGroups.activeTabGroup.activeTab
        ?.input as { [key: string]: any; uri: vscode.Uri | undefined };
      if (activeTabInput.uri) {
        vscode.commands.executeCommand(
          "vscode.openWith",
          activeTabInput.uri,
          "hexite.hexview"
        );
      }
    }
  );
  context.subscriptions.push(openWithCommand);

  context.subscriptions.push(HexiteProvider.register(context));
}
