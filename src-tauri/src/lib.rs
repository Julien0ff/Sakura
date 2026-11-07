mod commands;
mod links;
mod shell;

// Desktop only (Windows, Linux, macOS): tray, autostart, Discord IPC, release checks, self-update.
#[cfg(desktop)]
mod linux_icon;
#[cfg(desktop)]
mod notify;
#[cfg(desktop)]
mod presence;
#[cfg(desktop)]
mod tray;
#[cfg(desktop)]
mod update;

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

  builder = builder
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_opener::init())
    .manage(shell::PendingAuth::default());

  #[cfg(desktop)]
  {
    builder = builder
      // Size/position only: visibility is decided at launch (autostart starts hidden in the tray).
      .plugin(
        tauri_plugin_window_state::Builder::default()
          .with_state_flags(tauri_plugin_window_state::StateFlags::all() & !tauri_plugin_window_state::StateFlags::VISIBLE)
          .build(),
      )
      .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec![links::AUTOSTART_FLAG])))
      .plugin(tauri_plugin_updater::Builder::new().build())
      .manage(presence::spawn())
      .invoke_handler(tauri::generate_handler![
        commands::take_pending_auth,
        commands::open_external,
        commands::app_version,
        commands::retry_connection,
        commands::get_autostart,
        commands::set_autostart,
        commands::check_update,
        commands::install_update,
        commands::set_presence,
        commands::set_notify_targets,
        commands::presence_status,
      ])
      .on_window_event(|window, event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
          if window.label() == shell::MAIN {
            api.prevent_close();
            shell::hide_to_tray(window);
          }
        }
      });
  }

  #[cfg(mobile)]
  {
    builder = builder.invoke_handler(tauri::generate_handler![
      commands::take_pending_auth,
      commands::open_external,
      commands::app_version,
      commands::retry_connection,
    ]);
  }

  builder
    .setup(|app| {
      // Log file in every build (~/.local/share/app.sakura.desktop/logs, %APPDATA% on Windows):
      // the only way to diagnose Discord / updates / notifications on a user's machine.
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .max_file_size(512 * 1024)
          .build(),
      )?;
      #[cfg(all(target_os = "linux", not(debug_assertions)))]
      linux_icon::ensure();

      // AppImages aren't registered by an installer: register sakura:// at runtime. Not in dev
      // builds, which would steal the scheme from the installed app.
      #[cfg(all(any(windows, target_os = "linux"), not(debug_assertions)))]
      if let Err(e) = app.deep_link().register_all() {
        log::warn!("deep link registration failed: {e}");
      }

      let handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        shell::handle_deep_links(&handle, event.urls().into_iter().map(|u| u.to_string()));
      });

      shell::create_main_window(app.handle())?;

      #[cfg(desktop)]
      {
        use tauri::Manager;
        shell::build_tray(app.handle())?;
        update::spawn_checks(app.handle().clone());
        app.manage(notify::NotifyState::load(app.handle()));
        notify::spawn_checks(app.handle().clone());
      }

      // Cold start through a link: the URL is in the launch arguments / launch intent.
      if let Ok(Some(urls)) = app.deep_link().get_current() {
        shell::handle_deep_links(app.handle(), urls.into_iter().map(|u| u.to_string()));
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running SAKURA");
}
