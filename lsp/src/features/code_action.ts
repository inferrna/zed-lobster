import { CodeAction, CodeActionKind } from "vscode-languageserver";
import { LobsterDocumentState } from "../document";
import { LSPInstance } from "../lsp";

export default function setupFeature(lsp: LSPInstance) {
  lsp.connection.onCodeAction((params) => {
    lsp.connection.console.log("lsp.connection.onCodeAction fired");
    if (lsp.errorState) {
      lsp.connection.console.log("onCodeAction lsp is in error state");
      if (lsp.errorMsg) {
        lsp.connection.console.log("onCodeAction lsp fails with error: " + lsp.errorMsg);
      }
      return [];
    }
    lsp.connection.console.log(
      "onCodeAction Found " + lsp.documents.all().length + " documents",
    );
    lsp.documents.all().forEach((doc) => {
      lsp.connection.console.log("onCodeAction Found doc " + doc.uri);
    });

    const document = lsp.documents.get(params.textDocument.uri)!;
    if (document.state === LobsterDocumentState.HasErrors) {
      lsp.connection.console.log("onCodeAction document is in error state");
      return [];
    }

    const result: CodeAction[] = [];
    lsp.connection.console.log("onCodeAction Found "+params.context.diagnostics.length+" diagnostics messages");
    params.context.diagnostics.forEach((diagnostic) => {
      lsp.connection.console.log(
        "onCodeAction Found diagnostic message: " + diagnostic.message,
      );
      if (diagnostic.message.startsWith("use `let` to declare")) {
        const text = document.getText(diagnostic.range);
        const location = text.search("var");

        if (location == -1) return; // Can't find?

        const range = {
          start: { line: params.range.start.line, character: location },
          end: { line: params.range.start.line, character: location + 3 },
        };

        result.push({
          title: "Make variable constant",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          isPreferred: true,
          edit: {
            changes: {
              [document.uri]: [
                {
                  range,
                  newText: "let",
                },
              ],
            },
          },
        });
      }
    });

    return result;
  });
}
