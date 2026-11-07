//! Commands invoked by the SAKURA site (granted only to its origin, see capabilities/).

use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_opener::OpenerExt as _;

use crate::links::{is_allowed_external, AuthLink};
use crate::shell::{self, PendingAuth, TrayAutostart, MAIN};

/// Sign-in result received before the page could listen (cold start); cleared once read.
#[tauri::command]
pub fn take_pending_auth(state: State<'_, PendingAuth>) -> Option<AuthLink> {
  state.0.lock().unwrap().take()
}

/// Opens an `https:` URL in the system browser (OAuth, release page).
#[tauri::command]
pub fn open_external(app: AppHandle, url: String) -> Result<(), String> {
  if !is_allowed_external(&url) {
    return Err("URL refusée".into());
  }
  app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_autostart(app: AppHandle) -> bool {
  app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
  let mgr = app.autolaunch();
  if enabled { mgr.enable() } else { mgr.disable() }.map_err(|e| e.to_string())?;
  if let Some(item) = app.try_state::<TrayAutostart>() {
    let _ = item.0.set_checked(enabled);
  }
  Ok(())
}

#[tauri::command]
pub fn app_version(app: AppHandle) -> String {
  app.package_info().version.to_string()
}

/// Offline page « Réessayer »: load the site if it answers now.
#[tauri::command]
pub async fn retry_connection(app: AppHandle) -> bool {
  if !shell::site_reachable().await {
    return false;
  }
  if let Some(w) = app.get_webview_window(MAIN) {
    let _ = w.navigate(shell::site_url());
  }
  true
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<crate::update::UpdateInfo>, String> {
  crate::update::try_check(&app).await
}

/// Downloads, installs and restarts (Windows, AppImage).
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
  crate::update::install(&app).await
}

/// Discord activity while watching; `None` clears it.
#[tauri::command]
pub fn set_presence(state: State<'_, crate::presence::Presence>, activity: Option<crate::presence::PresencePayload>) {
  state.set(activity);
}

/// Anime + languages to watch for new episodes (from « Ma liste » and the settings).
#[tauri::command]
pub fn set_notify_targets(app: AppHandle, state: State<'_, crate::notify::NotifyState>, targets: crate::notify::Targets) {
  state.set(&app, targets);
}

/// Discord connection state, shown in Settings › Application.
#[tauri::command]
pub fn presence_status(state: State<'_, crate::presence::Presence>) -> crate::presence::PresenceStatus {
  state.status()
}
