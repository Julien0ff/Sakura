//! Desktop only: tray icon (menu: open, reload, autostart, quit) and close-to-tray.

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_notification::NotificationExt as _;

use crate::shell::{show_main, site_url, MAIN};

fn toggle_main(app: &AppHandle) {
  if let Some(w) = app.get_webview_window(MAIN) {
    if w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false) {
      let _ = w.hide();
    } else {
      show_main(app);
    }
  }
}

pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
  let autostart_on = app.autolaunch().is_enabled().unwrap_or(false);
  let open = MenuItem::with_id(app, "open", "Ouvrir SAKURA", true, None::<&str>)?;
  let reload = MenuItem::with_id(app, "reload", "Recharger", true, None::<&str>)?;
  let autostart = CheckMenuItem::with_id(app, "autostart", "Lancer au démarrage", true, autostart_on, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
  let menu: Menu<Wry> = Menu::with_items(app, &[&open, &reload, &autostart, &PredefinedMenuItem::separator(app)?, &quit])?;
  let autostart_item = autostart.clone();
  app.manage(TrayAutostart(autostart));

  let mut tray = TrayIconBuilder::with_id("sakura")
    .tooltip("SAKURA")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(move |app, event| match event.id.as_ref() {
      "open" => show_main(app),
      // Way back when the site failed after launch (engine error page has no retry).
      "reload" => {
        if let Some(w) = app.get_webview_window(MAIN) {
          let _ = w.navigate(site_url());
        }
        show_main(app);
      }
      "autostart" => {
        let mgr = app.autolaunch();
        let enable = !mgr.is_enabled().unwrap_or(false);
        let _ = if enable { mgr.enable() } else { mgr.disable() };
        let _ = autostart_item.set_checked(mgr.is_enabled().unwrap_or(enable));
      }
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
        toggle_main(tray.app_handle());
      }
    });
  if let Some(icon) = app.default_window_icon() {
    tray = tray.icon(icon.clone());
  }
  tray.build(app)?;
  Ok(())
}

/// Tray checkbox, kept so Settings › Application can resync it.
pub struct TrayAutostart(pub CheckMenuItem<Wry>);

/// Close button hides to the tray; the first time, a notification explains it.
pub fn hide_to_tray(window: &tauri::Window) {
  let _ = window.hide();
  let app = window.app_handle();
  let Ok(dir) = app.path().app_data_dir() else { return };
  let flag = dir.join("tray-hint-shown");
  if flag.exists() {
    return;
  }
  let _ = std::fs::create_dir_all(&dir);
  let _ = std::fs::write(&flag, b"1");
  let _ = app
    .notification()
    .builder()
    .title("SAKURA reste dans la barre des tâches")
    .body("Cliquez sur l’icône pour rouvrir l’app. « Quitter » est dans son menu.")
    .show();
}
