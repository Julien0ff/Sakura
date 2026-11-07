fn main() {
  // App commands get generated permissions (`allow-<command>`) so the remote-site capability can
  // grant them explicitly.
  tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
    "take_pending_auth",
    "open_external",
    "get_autostart",
    "set_autostart",
    "app_version",
    "retry_connection",
    "check_update",
    "install_update",
  ])))
  .expect("failed to run tauri-build");
}
