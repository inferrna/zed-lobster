import {
  Connection,
  TextDocuments,
  WorkspaceFolder,
} from "vscode-languageserver";
import { exec } from "child_process";
import { URI } from "vscode-uri";
import { LobsterDocument, LobsterDocumentState } from "./document";

export interface LobsterSettings {
  executable: string;
  imports: string[];
  experimental: boolean;
}

export enum ErroredState {
  None,
  InvalidExecutable,
}

const defaultSettings: LobsterSettings = {
  executable: "lobster",
  imports: [],
  experimental: true,
};

export class LSPInstance {
  connection: Connection;
  tempDir: string;
  globalSettings: LobsterSettings = defaultSettings;
  errorState: ErroredState | null = null;
  executable: string = "lobster";
  errorMsg: string | null = null;

  readonly documents: TextDocuments<LobsterDocument> = new TextDocuments(
    LobsterDocument,
  );
  // Cached per document settings
  readonly documentSettings: Map<URI, Thenable<LobsterSettings>> = new Map();

  hasConfigurationCapability = false;

  constructor(connection: Connection, tempDir: string) {
    this.tempDir = tempDir;
    this.connection = connection;

    this.documents.onDidClose((e) => {
      this.documentSettings.delete(URI.parse(e.document.uri));
    });

    this.documents.onDidChangeContent((change) => {
      this.validateDocument(change.document);
    });

    this.documents.listen(this.connection);
  }

  readConfiguration(uri: URI): Promise<LobsterSettings> {
    this.connection.console.log("readConfiguration");
    const config = this.connection.workspace.getConfiguration({
      scopeUri: uri.toString(),
      section: "lobster",
    }) as Promise<LobsterSettings>;

    this.connection.console.log("readConfiguration got remote configuration");

    //Validate config
    config.then((c) => {
      const throwError = (msg: string) => {
        this.connection.console.log("readConfiguration Error: " + msg);
        this.connection.window.showErrorMessage(msg);
        this.errorState = ErroredState.InvalidExecutable;
        this.errorMsg = msg;
        return config;
      };

      console.log("\n");
      console.dir(config, { depth: 0, colors: true });
      console.dir(c, { depth: 0, colors: true });
      if (this.executable.length == 0)
        return throwError(
          "readConfiguration Lobster executable path is not set.",
        );

      exec(this.executable, (error, stdout, stderr) => {
        this.connection.console.log("readConfiguration exec");
        if (stderr) {
          return throwError(
            `Lobster (${this.executable}) returned with output: ${stderr}`,
          );
        } else if (error && error.code != 1) {
          // If errorcode 1 then its the help message
          return throwError(
            `Lobster (${this.executable}) failed to execute: ${error.message}`,
          );
        } else if (!stdout.startsWith("Lobster programming language")) {
          return throwError(
            `Lobster (${this.executable}) returned with unexpected output (is this a lobster binary?): ${stdout}`,
          );
        }
      });
    });

    if (config) {
      this.connection.console.log("readConfiguration set config for " + uri);
      this.documentSettings.set(uri, config);
    } else {
      this.connection.console.log("readConfiguration empty config for " + uri);
    }
    return config;
  }

  async getDocumentSettings(uri: URI): Promise<LobsterSettings> {
    this.connection.console.log("getDocumentSettings start");
    if (!this.hasConfigurationCapability) {
      this.connection.console.log(
        "getDocumentSettings get from globalSettings",
      );
      return Promise.resolve(this.globalSettings);
    }

    let result = this.documentSettings.get(uri);
    if (!result) {
      this.connection.console.log("getDocumentSettings get conf from uri");
      result = this.readConfiguration(uri);
    }

    this.connection.console.log("getDocumentSettings getWorkspaceFoldersPaths");
    //const folders = await this.getWorkspaceFoldersPaths();
    const folders = [uri.fsPath];
    this.connection.console.log("getDocumentSettings returning");
    return result.then((s) =>
      s
        ? {
            executable: s.executable || this.globalSettings.executable,
            imports: [...s.imports, ...folders],
            experimental: s.experimental || this.globalSettings.experimental,
          }
        : defaultSettings,
    );
  }

  async validateDocument(document: LobsterDocument) {
    const noErrBefore = document.state === LobsterDocumentState.NoErrors;
    const diagnostics = await document.parse(this);
    if (!noErrBefore || diagnostics.length > 0) {
      this.connection.sendDiagnostics({
        uri: document.uri,
        diagnostics,
      });
    } else {
      this.connection.console.error("validateDocument no result");
    }
  }

  async getWorkspaceFolders(): Promise<WorkspaceFolder[] | null> {
    if (!this.connection) return null;
    if (this.errored()) return null;

    return this.connection.workspace.getWorkspaceFolders();
  }

  async getWorkspaceFoldersPaths(): Promise<string[]> {
    if (this.errored()) {
      this.connection.console.error("Errored state");
      return ["1"];
    }

    const folders = await this.getWorkspaceFolders();
    if (!folders) {
      this.connection.console.error("No folders");
      return ["2"];
    }
    return folders.map((f) => URI.parse(f.uri).fsPath);
  }

  errored(): boolean {
    return this.errorState != null;
  }
}
