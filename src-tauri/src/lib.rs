mod commands;
mod links;
mod notify;
mod presence;
mod shell;
mod update;

use tauri::{Manager, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt as _;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // Must be the first plugin: a 2nd launch (e.g. a sakura:// link on Windows/Linux) is forwarded
  // here, then exits. The deep-link feature re-emits its URL through on_open_url.
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      shell::show_main(app);
    }));
  }

  builder
    .plugin(tauri_plugin_deep_link::init())
    // Size/position only: visibility is decided at launch (autostart starts hidden in the tray).
    .plugin(
      tauri_plugin_window_state::Builder::default()
        .with_state_flags(tauri_plugin_window_state::StateFlags::all() & !tauri_plugin_window_state::StateFlags::VISIBLE)
        .build(),
    )
    .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec![links::AUTOSTART_FLAG])))
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .manage(shell::PendingAuth::default())
    .manage(presence::spawn())
    .invoke_handler(tauri::generate_handler![
      commands::take_pending_auth,
      commands::open_external,
      commands::get_autostart,
      commands::set_autostart,
      commands::app_version,
      commands::retry_connection,
      commands::check_update,
      commands::install_update,
      commands::set_presence,
      commands::set_notify_targets,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
      }

      // AppImage and dev builds aren't registered by an installer: register sakura:// at runtime.
      #[cfg(any(windows, target_os = "linux"))]
      if let Err(e) = app.deep_link().register_all() {
        log::warn!("deep link registration failed: {e}");
      }

      let handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        shell::handle_deep_links(&handle, event.urls().into_iter().map(|u| u.to_string()));
      });

      shell::create_main_window(app.handle())?;
      shell::build_tray(app.handle())?;
      update::spawn_checks(app.handle().clone());
      app.manage(notify::NotifyState::load(app.handle()));
      notify::spawn_checks(app.handle().clone());

      // Cold start through a link: the URL is in the launch arguments.
      if let Ok(Some(urls)) = app.deep_link().get_current() {
        shell::handle_deep_links(app.handle(), urls.into_iter().map(|u| u.to_string()));
      }
      Ok(())
    })
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == shell::MAIN {
          api.prevent_close();
          shell::hide_to_tray(window);
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running SAKURA");
}
