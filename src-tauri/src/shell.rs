//! Main window (live site or offline page) and sign-in deep links. Desktop and mobile.

use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::links::{parse_auth_link, AuthLink, DEV_URL, PROD_URL};

#[cfg(desktop)]
pub use crate::tray::{build_tray, hide_to_tray, TrayAutostart};

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
  let builder = WebviewWindowBuilder::new(app, MAIN, url);

  #[cfg(desktop)]
  let builder = {
    use crate::links::{is_allowed_external, starts_hidden};
    use tauri::webview::NewWindowResponse;
    use tauri_plugin_opener::OpenerExt as _;
    let hidden = starts_hidden(&std::env::args().collect::<Vec<_>>());
    let opener = app.clone();
    builder
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
  };
  // Mobile: one full-screen webview; external links are routed to the browser by the site.

  let window = builder.build()?;
  #[cfg(target_os = "ios")]
  edge_to_edge_ios(&window);
  #[cfg(target_os = "ios")]
  playback_audio_session_ios();
  Ok(window)
}

/// iPhone: by default WKWebView pads its scroll view with the safe areas (status bar, home
/// indicator), so the page stops above the home indicator and CSS `env(safe-area-inset-*)` reads 0.
/// `Never` lets the page draw edge to edge; the site handles the safe areas itself (viewport-fit=cover).
#[cfg(target_os = "ios")]
fn edge_to_edge_ios(window: &WebviewWindow) {
  let _ = window.with_webview(|w| {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    let ptr = w.inner() as *const AnyObject;
    if ptr.is_null() {
      return;
    }
    // SAFETY: `inner()` is the live WKWebView, used on the main thread (with_webview).
    unsafe {
      let webview: &AnyObject = &*ptr;
      let scroll: *mut AnyObject = msg_send![webview, scrollView];
      if !scroll.is_null() {
        // UIScrollViewContentInsetAdjustmentNever
        let _: () = msg_send![&*scroll, setContentInsetAdjustmentBehavior: 2isize];
      }
    }
  });
}

/// iPhone: the default audio session (« ambient ») stops the episode when the app goes to the
/// background and refuses picture-in-picture. « Playback » keeps it playing (picture-in-picture,
/// lock screen « Now Playing ») and ignores the silent switch, like any video app. Needs the
/// `audio` background mode in Info.plist (CI). Only declared here: WebKit activates the session
/// when a video starts, so other apps' audio is not interrupted at launch.
#[cfg(target_os = "ios")]
fn playback_audio_session_ios() {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject, Bool};
  let (Some(session_class), Some(string_class)) = (AnyClass::get(c"AVAudioSession"), AnyClass::get(c"NSString")) else {
    log::warn!("AVAudioSession unavailable");
    return;
  };
  // SAFETY: class methods of AVFoundation / Foundation; null results are checked before use.
  unsafe {
    let session: *mut AnyObject = msg_send![session_class, sharedInstance];
    let category: *mut AnyObject = msg_send![string_class, stringWithUTF8String: c"AVAudioSessionCategoryPlayback".as_ptr()];
    if session.is_null() || category.is_null() {
      return;
    }
    let ok: Bool = msg_send![&*session, setCategory: &*category, error: std::ptr::null_mut::<*mut AnyObject>()];
    if !ok.as_bool() {
      log::warn!("AVAudioSession: playback category refused");
    }
  }
}

pub fn show_main(app: &AppHandle) {
  #[cfg(desktop)]
  if let Some(w) = app.get_webview_window(MAIN) {
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_focus();
    // Wayland compositors (KDE, GNOME) refuse focus stealing: flash the taskbar entry instead.
    if !w.is_focused().unwrap_or(false) {
      let _ = w.request_user_attention(Some(tauri::UserAttentionType::Informational));
    }
  }
  // Mobile: the OS brings the app to the front when it opens the sakura:// link.
  #[cfg(mobile)]
  let _ = app;
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
