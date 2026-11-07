//! Self-update from GitHub Releases (latest.json), checked at startup and every 6 hours.

use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt as _;

use crate::shell::MAIN;

const FIRST_CHECK: Duration = Duration::from_secs(20);
const EVERY: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
  pub version: String,
  pub notes: Option<String>,
  /// false for .deb / .rpm installs: the user downloads the new package from the release page.
  pub installable: bool,
}

/// The updater can replace the app in place on Windows (NSIS/MSI) and for AppImages only.
pub fn is_installable(os: &str, appimage: bool) -> bool {
  match os {
    "windows" => true,
    "linux" => appimage,
    _ => false,
  }
}

fn installable_here() -> bool {
  is_installable(std::env::consts::OS, std::env::var_os("APPIMAGE").is_some())
}

/// `None` when up to date or when the check fails (offline, no release yet).
pub async fn check(app: &AppHandle) -> Option<UpdateInfo> {
  let updater = app.updater().map_err(|e| log::warn!("updater unavailable: {e}")).ok()?;
  match updater.check().await {
    Ok(Some(u)) => Some(UpdateInfo { version: u.version.clone(), notes: u.body.clone(), installable: installable_here() }),
    Ok(None) => None,
    Err(e) => {
      log::warn!("update check failed: {e}");
      None
    }
  }
}

pub async fn install(app: &AppHandle) -> Result<(), String> {
  if !installable_here() {
    return Err("Installez la nouvelle version depuis la page de téléchargement.".into());
  }
  let update = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
  let Some(update) = update else { return Ok(()) };
  update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
  app.restart();
}

/// Background loop: announce new versions to the page (it shows a toast).
pub fn spawn_checks(app: AppHandle) {
  tauri::async_runtime::spawn(async move {
    tokio::time::sleep(FIRST_CHECK).await;
    loop {
      if let Some(info) = check(&app).await {
        let _ = app.emit_to(MAIN, "update-available", info);
      }
      tokio::time::sleep(EVERY).await;
    }
  });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installable_on_windows_and_appimage_only() {
        assert!(is_installable("windows", false));
        assert!(is_installable("linux", true));
        assert!(!is_installable("linux", false)); // .deb / .rpm: package manager territory
        assert!(!is_installable("macos", false));
    }
}
