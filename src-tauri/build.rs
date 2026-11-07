fn main() {
  social_sdk();
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
    "set_presence",
    "set_notify_targets",
    "presence_status",
    "discord_link",
    "discord_unlink",
    "discord_status",
  ])))
  .expect("failed to run tauri-build");
}

/// Discord Social SDK (mobile Discord status). Never in the repo: CI downloads it from a private
/// repo and sets `DISCORD_SOCIAL_SDK` (folder with `android/jni/<abi>/` and `ios/`). Without it the
/// apps build normally and report the Discord status as unavailable.
/// Linux, tests only: `--features social-sdk-test` + `DISCORD_SOCIAL_SDK_LIB` (folder of the .so).
fn social_sdk() {
  println!("cargo::rustc-check-cfg=cfg(social_sdk)");
  println!("cargo::rerun-if-env-changed=DISCORD_SOCIAL_SDK");
  println!("cargo::rerun-if-env-changed=DISCORD_SOCIAL_SDK_LIB");
  let os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
  let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();

  match os.as_str() {
    "android" => {
      let Ok(sdk) = std::env::var("DISCORD_SOCIAL_SDK") else { return };
      let abi = match arch.as_str() {
        "aarch64" => "arm64-v8a",
        "arm" => "armeabi-v7a",
        "x86" => "x86",
        "x86_64" => "x86_64",
        _ => return,
      };
      // The .so itself ships in the app through the .aar (Gradle dependency).
      println!("cargo::rustc-link-search=native={sdk}/android/jni/{abi}");
      println!("cargo::rustc-link-lib=dylib=discord_partner_sdk");
      println!("cargo::rustc-cfg=social_sdk");
    }
    // Xcode links and embeds discord_partner_sdk.xcframework into the app (project.yml); the crate's
    // own dynamic library (cdylib) is linked here against the matching slice.
    "ios" => {
      let Ok(sdk) = std::env::var("DISCORD_SOCIAL_SDK") else { return };
      let sim = std::env::var("CARGO_CFG_TARGET_ABI").is_ok_and(|a| a == "sim");
      let slice = if sim { "ios-arm64-simulator" } else { "ios-arm64" };
      println!("cargo::rustc-link-search=framework={sdk}/ios/discord_partner_sdk.xcframework/{slice}");
      println!("cargo::rustc-link-lib=framework=discord_partner_sdk");
      println!("cargo::rustc-cfg=social_sdk");
    }
    "linux" if std::env::var("CARGO_FEATURE_SOCIAL_SDK_TEST").is_ok() => {
      let lib = std::env::var("DISCORD_SOCIAL_SDK_LIB").expect("social-sdk-test needs DISCORD_SOCIAL_SDK_LIB");
      println!("cargo::rustc-link-search=native={lib}");
      println!("cargo::rustc-link-lib=dylib=discord_partner_sdk");
      println!("cargo::rustc-link-arg=-Wl,-rpath,{lib}");
      println!("cargo::rustc-cfg=social_sdk");
    }
    _ => {}
  }
}
