// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // WebKitGTK's DMA-BUF renderer glitches on the NVIDIA proprietary driver; elsewhere (Intel, AMD)
  // it is the fast path, so only opt out on NVIDIA, unless the user chose otherwise.
  #[cfg(target_os = "linux")]
  if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() && std::path::Path::new("/proc/driver/nvidia/version").exists() {
    // SAFETY: single-threaded, before any other thread starts.
    unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
  }
  app_lib::run();
}
