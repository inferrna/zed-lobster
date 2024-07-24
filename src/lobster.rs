use std::env;
use std::fs;

use serde_json::json;
use zed_extension_api::lsp::Symbol;
use zed_extension_api::settings::BinarySettings;
use zed_extension_api::{
    current_platform, download_file, latest_github_release,
    lsp::{Completion, CompletionKind},
    make_file_executable, register_extension, set_language_server_installation_status,
    settings::LspSettings,
    CodeLabel, CodeLabelSpan, DownloadedFileType, Extension, GithubReleaseOptions,
    LanguageServerId, LanguageServerInstallationStatus, Os, Result, Worktree,
};
const SERVER_PATH: &str = "lsp/webpack-out/lobster_lsp.js";
const EXT_DIR: &str = "lobster_ext_dist";
const VSC_EXT_URL: &str = "http://github.com/aardappel/lobster/raw/master/docs/vscode/lobster.vsix";


struct LobsterExtension {
    cached_binary_path: Option<String>,
}

impl LobsterExtension {
    fn language_server_binary_path(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<String> {
        if let Some(path) = &self.cached_binary_path {
            if fs::metadata(path).map_or(false, |stat| stat.is_file()) {
                return Ok(path.clone());
            }
        }
        set_language_server_installation_status(
            &language_server_id,
            &LanguageServerInstallationStatus::CheckingForUpdate,
        );

        download_file(VSC_EXT_URL, EXT_DIR, DownloadedFileType::Zip)
            .map_err(|e| format!("failed to download file: {e}"))?;

        let lsp_path = format!("{EXT_DIR}/{SERVER_PATH}");

        match fs::metadata(&lsp_path) {
            Ok(m) => {
                if m.is_file() {
                    self.cached_binary_path = Some(lsp_path.clone());
                    Ok(lsp_path)
                } else {
                    Err(format!("{lsp_path} found but it is not a file"))
                }
            }
            Err(e) => Err(e.to_string()),
        }
    }
}

impl Extension for LobsterExtension {
    fn new() -> Self {
        println!("At least we run new");
        Self {
            cached_binary_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<zed_extension_api::Command> {
        Ok(zed_extension_api::Command {
            //command: zed_extension_api::node_binary_path()?,
            //args: vec![abs_lsp_script_path, "--stdio".to_string()],
            command: "/home/inferno/.dev/Esoteric/zed-lobster/teelsp.sh".to_string(),
            args: vec![],
            env: Default::default(),
        })
    }

    fn language_server_workspace_configuration(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Option<serde_json::Value>> {
        println!("At least we run language_server_workspace_configuration");
        let settings = LspSettings::for_worktree(language_server_id.as_ref(), worktree).map_err(|e| {
            eprintln!(
                "Got error '{}' in file {} on line {}",
                e.as_str(),
                file!(),
                line!()
            );
            e
        })?;
        dbg!(&settings.settings);
        Ok(settings.settings)
        //Ok(Some(json!({"executable": null, "imports": [], "experimental": false})))
    }
    fn label_for_completion(
        &self,
        _language_server_id: &LanguageServerId,
        completion: Completion,
    ) -> Option<CodeLabel> {
        println!(
            "Call to label_for_completion with completion {:?}",
            &completion
        );
        None
    }

    fn language_server_initialization_options(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Option<serde_json::Value>> {
        println!("At least we run language_server_initialization_options");
        let settings =
            LspSettings::for_worktree(language_server_id.as_ref(), worktree).map_err(|e| {
                eprintln!(
                    "Got error '{}' in file {} on line {}",
                    e.as_str(),
                    file!(),
                    line!()
                );
                e
            })?;
        Ok(settings.initialization_options)
    }

    fn label_for_symbol(
        &self,
        _language_server_id: &LanguageServerId,
        _symbol: Symbol,
    ) -> Option<CodeLabel> {
        None
    }
}

register_extension!(LobsterExtension);
