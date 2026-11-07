//! Discord status content shared by the PC app (IPC, `presence.rs`) and the mobile apps (Social SDK,
//! `discord_sdk`): the activity the site sends, checked against Discord's rules.

use serde::Deserialize;

use crate::links::is_allowed_external;

/// Discord application « SAKURA ».
pub const CLIENT_ID: &str = "1568341036894523432";

/// Activity sent by the site (src/lib/presence.ts). Timestamps in epoch seconds.
#[derive(Debug, Clone, Deserialize)]
pub struct PresencePayload {
    pub details: String,
    pub state: String,
    pub large_image: Option<String>,
    pub large_text: String,
    pub small_image: String,
    pub small_text: String,
    pub start: Option<i64>,
    pub end: Option<i64>,
    pub button_label: String,
    pub button_url: String,
    /// `"name"` while browsing (« Regarde SAKURA »); otherwise the anime shows in the status line.
    #[serde(default)]
    pub display: Option<String>,
}

/// Payload checked against Discord's rules (and our own: https only).
#[derive(Debug, Clone, PartialEq)]
pub struct CleanPresence {
    pub details: String,
    pub state: String,
    pub large_image: Option<String>,
    pub large_text: String,
    pub small_image: Option<String>,
    pub small_text: String,
    pub start: Option<i64>,
    pub end: Option<i64>,
    pub button_label: String,
    pub button_url: Option<String>,
    pub show_app_name: bool,
}

/// Discord rejects text fields outside 2–128 characters.
fn fit(s: &str, max: usize) -> String {
    let t: String = s.trim().chars().take(max).collect();
    if t.chars().count() < 2 { format!("{t:<2}") } else { t }
}

fn https(url: Option<String>) -> Option<String> {
    url.filter(|u| is_allowed_external(u))
}

pub fn sanitize(p: PresencePayload) -> CleanPresence {
    let (start, end) = match (p.start, p.end) {
        (Some(s), Some(e)) if s > 0 && e > s => (Some(s), Some(e)),
        (Some(s), None) if s > 0 => (Some(s), None),
        _ => (None, None),
    };
    CleanPresence {
        details: fit(&p.details, 128),
        state: fit(&p.state, 128),
        large_image: https(p.large_image),
        large_text: fit(&p.large_text, 128),
        small_image: https(Some(p.small_image)),
        small_text: fit(&p.small_text, 128),
        start,
        end,
        button_label: fit(&p.button_label, 32),
        button_url: https(Some(p.button_url)),
        show_app_name: p.display.as_deref() == Some("name"),
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    pub fn payload() -> PresencePayload {
        PresencePayload {
            details: "Death Note".into(),
            state: "Épisode 12 · VOSTFR".into(),
            large_image: Some("https://s4.anilist.co/c.jpg".into()),
            large_text: "Death Note".into(),
            small_image: "https://sakura.thefoxy.me/icon.png".into(),
            small_text: "SAKURA".into(),
            start: Some(10),
            end: Some(20),
            button_label: "Regarder sur SAKURA".into(),
            button_url: "https://sakura.thefoxy.me/anime?id=1".into(),
            display: None,
        }
    }

    #[test]
    fn status_line_shows_the_anime_unless_browsing() {
        assert!(!sanitize(payload()).show_app_name);
        assert!(sanitize(PresencePayload { display: Some("name".into()), ..payload() }).show_app_name);
    }

    #[test]
    fn keeps_a_valid_payload() {
        let p = sanitize(payload());
        assert_eq!(p.details, "Death Note");
        assert_eq!(p.large_image.as_deref(), Some("https://s4.anilist.co/c.jpg"));
        assert_eq!(p.button_url.as_deref(), Some("https://sakura.thefoxy.me/anime?id=1"));
        assert_eq!((p.start, p.end), (Some(10), Some(20)));
    }

    #[test]
    fn clamps_text_to_discord_limits() {
        let p = sanitize(PresencePayload { details: "x".repeat(300), state: "a".into(), ..payload() });
        assert_eq!(p.details.chars().count(), 128);
        assert_eq!(p.state, "a ");
    }

    #[test]
    fn drops_non_https_images_and_buttons() {
        let p = sanitize(PresencePayload {
            large_image: Some("javascript:x".into()),
            button_url: "http://evil.example".into(),
            ..payload()
        });
        assert_eq!(p.large_image, None);
        assert_eq!(p.button_url, None);
    }

    #[test]
    fn drops_inconsistent_timestamps() {
        let p = sanitize(PresencePayload { start: Some(30), end: Some(20), ..payload() });
        assert_eq!((p.start, p.end), (None, None));
    }
}
