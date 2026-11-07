//! Main window (live site or offline page), tray icon, close-to-tray and sign-in deep links.

use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Wry};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_notification::NotificationExt as _;

use crate::links::{is_allowed_external, parse_auth_link, starts_hidden, AuthLink, DEV_URL, PROD_URL};
use tauri::webview::NewWindowResponse;
use tauri_plugin_opener::OpenerExt as _;

pub const MAIN: &str = "main";

/// Sign-in result waiting for the page (cold start: the link arrives before the site has loaded).
#[derive(Default)]
pub struct PendingAuth(pub Mutex<Option<AuthLink>>);

pub fn site_url() -> Url {
  let raw = if cfg!(debug_assertions) { DEV_URL } else { PROD_URL };
  Url::parse(raw).expect("valid site url")
}

/// Short reachability probe of the site (any HTTP answer counts as online).
pub async fn site_reachable() -> bool {
  let Ok(client) = reqwest::Client::builder().timeout(Duration::from_secs(5)).build() else {
    return false;
  };
  client.head(site_url()).send().await.is_ok()
}

pub fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
  let online = tauri::async_runtime::block_on(site_reachable());
  let url = if online { WebviewUrl::External(site_url()) } else { WebviewUrl::App("index.html".into()) };
  let hidden = starts_hidden(&std::env::args().collect::<Vec<_>>());
  let opener = app.clone();
  WebviewWindowBuilder::new(app, MAIN, url)
    .title("SAKURA")
    .inner_size(1280.0, 800.0)
    .min_inner_size(960.0, 600.0)
    .center()
    .visible(!hidden)
    // target="_blank" links (AniList, TMDB, IMDb, legal…) open in the system browser.
    // No navigation guard on purpose: WebKitGTK applies it to iframes too (video players).
    .on_new_window(move |url, _features| {
      if is_allowed_external(url.as_str()) {
        let _ = opener.opener().open_url(url.as_str(), None::<&str>);
      }
      NewWindowResponse::Deny
    })
    .build()
}

pub fn show_main(app: &AppHandle) {
  if let Some(w) = app.get_webview_window(MAIN) {
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_focus();
    // Wayland compositors (KDE, GNOME) refuse focus stealing: flash the taskbar entry instead.
    if !w.is_focused().unwrap_or(false) {
      let _ = w.request_user_attention(Some(tauri::UserAttentionType::Informational));
    }
  }
}

fn toggle_main(app: &AppHandle) {
  if let Some(w) = app.get_webview_window(MAIN) {
    if w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false) {
      let _ = w.hide();
    } else {
      show_main(app);
    }
  }
}

/// Handles `sakura://` links: keep the sign-in result for the page, push it if the page listens, focus.
pub fn handle_deep_links(app: &AppHandle, urls: impl IntoIterator<Item = String>) {
  for raw in urls {
    if let Some(link) = parse_auth_link(&raw) {
      log::info!("sign-in deep link received (code: {}, error: {})", link.code.is_some(), link.error.is_some());
      if let Some(state) = app.try_state::<PendingAuth>() {
        *state.0.lock().unwrap() = Some(link.clone());
      }
      let _ = app.emit_to(MAIN, "auth-callback", link);
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
