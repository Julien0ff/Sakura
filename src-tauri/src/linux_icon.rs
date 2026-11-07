//! Wayland window icon (Linux): KDE / GNOME pick the title-bar icon from the desktop entry whose
//! name matches the window's app id (`sakura`). Installers ship `SAKURA.desktop` (deb/rpm) or an
//! AppImageLauncher entry, so a hidden `sakura.desktop` + icon are written to the user's data dir.
// Only called by release builds on Linux.
#![cfg_attr(any(debug_assertions, not(target_os = "linux")), allow(dead_code))]

/// Hidden entry (not listed in menus) that only gives the window its name and icon.
pub fn desktop_entry(exe: &str) -> String {
    let exec = exe.replace('\\', "\\\\").replace('"', "\\\"");
    format!(
        "[Desktop Entry]\nType=Application\nName=SAKURA\nIcon=sakura\nExec=\"{exec}\"\nNoDisplay=true\nStartupWMClass=sakura\nTerminal=false\n"
    )
}

/// The `sakura://` handler written by the deep-link plugin is also named « SAKURA »: AppImageLauncher
/// then names its own menu entry « SAKURA (1) ». Returns the entry with a distinct name, or None if
/// it already has one.
pub fn rename_handler_entry(src: &str) -> Option<String> {
    let mut changed = false;
    let out: Vec<&str> = src
        .split('\n')
        .map(|line| {
            if line == "Name=SAKURA" {
                changed = true;
                "Name=SAKURA (liens)"
            } else {
                line
            }
        })
        .collect();
    changed.then(|| out.join("\n"))
}

/// Renames the `sakura://` handler entry (after `register_all`, release builds, Linux).
#[cfg(target_os = "linux")]
pub fn rename_handler() {
    let Some(data) = data_dir() else { return };
    let path = data.join("applications/sakura-handler.desktop");
    let Ok(src) = std::fs::read_to_string(&path) else { return };
    if let Some(out) = rename_handler_entry(&src) {
        if let Err(e) = std::fs::write(&path, out) {
            log::warn!("could not write {}: {e}", path.display());
        }
    }
}

#[cfg(target_os = "linux")]
fn data_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("XDG_DATA_HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".local/share")))
}

/// Writes the icon and the hidden entry if they're missing or outdated (release builds, Linux).
#[cfg(target_os = "linux")]
pub fn ensure() {
    const ICON: &[u8] = include_bytes!("../icons/128x128@2x.png");
    let Some(data) = data_dir() else { return };
    // AppImages run from a temporary mount: point at the .AppImage file itself.
    let exe = std::env::var("APPIMAGE")
        .ok()
        .or_else(|| std::env::current_exe().ok().map(|p| p.to_string_lossy().into_owned()));
    let Some(exe) = exe else { return };

    let write_if_changed = |path: std::path::PathBuf, bytes: &[u8]| {
        if std::fs::read(&path).ok().as_deref() == Some(bytes) {
            return;
        }
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        if let Err(e) = std::fs::write(&path, bytes) {
            log::warn!("could not write {}: {e}", path.display());
        }
    };
    write_if_changed(data.join("icons/hicolor/256x256/apps/sakura.png"), ICON);
    write_if_changed(data.join("applications/sakura.desktop"), desktop_entry(&exe).as_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hidden_entry_points_to_the_executable() {
        let e = desktop_entry("/home/me/Applications/SAKURA 0.2.AppImage");
        assert!(e.starts_with("[Desktop Entry]\n"));
        assert!(e.contains("\nNoDisplay=true\n"));
        assert!(e.contains("\nIcon=sakura\n"));
        assert!(e.contains("\nStartupWMClass=sakura\n"));
        assert!(e.contains("\nExec=\"/home/me/Applications/SAKURA 0.2.AppImage\"\n"));
    }

    #[test]
    fn link_handler_gets_its_own_name() {
        let src = "[Desktop Entry]\nType=Application\nName=SAKURA\nExec=\"/a\" %u\nNoDisplay=true\n";
        let out = rename_handler_entry(src).expect("renamed");
        assert!(out.contains("\nName=SAKURA (liens)\n"));
        assert!(!out.contains("\nName=SAKURA\n"));
        assert!(out.contains("\nExec=\"/a\" %u\n"));
        // Already renamed: nothing to write.
        assert_eq!(rename_handler_entry(&out), None);
    }

    #[test]
    fn quotes_are_escaped_in_exec() {
        assert!(desktop_entry("/a\"b").contains("Exec=\"/a\\\"b\""));
    }
}
