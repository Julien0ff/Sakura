//! Discord Rich Presence: a dedicated thread owns the IPC connection, remembers the activity
//! the site asked for, and (re)connects while Discord is not running.

use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::time::Duration;

use discord_rich_presence::activity::{Activity, ActivityType, Assets, Button, StatusDisplayType, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use serde::Deserialize;

use crate::links::is_allowed_external;

/// Discord application « SAKURA ».
const CLIENT_ID: &str = "1568341036894523432";
const RETRY: Duration = Duration::from_secs(15);

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

fn to_activity(p: &CleanPresence) -> Activity<'_> {
    let mut assets = Assets::new().large_text(p.large_text.as_str()).small_text(p.small_text.as_str());
    if let Some(img) = &p.large_image {
        assets = assets.large_image(img.as_str());
    }
    if let Some(img) = &p.small_image {
        assets = assets.small_image(img.as_str());
    }
    let mut activity = Activity::new()
        .activity_type(ActivityType::Watching)
        // Watching: member list shows « Regarde <anime> »; browsing: « Regarde SAKURA ».
        .status_display_type(if p.show_app_name { StatusDisplayType::Name } else { StatusDisplayType::Details })
        .details(p.details.as_str())
        .state(p.state.as_str())
        .assets(assets);
    if let Some(start) = p.start {
        let mut ts = Timestamps::new().start(start);
        if let Some(end) = p.end {
            ts = ts.end(end);
        }
        activity = activity.timestamps(ts);
    }
    if let Some(url) = &p.button_url {
        activity = activity.buttons(vec![Button::new(p.button_label.as_str(), url.as_str())]);
    }
    activity
}

/// What Settings › Application shows.
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PresenceStatus {
    /// Nothing to show yet (no video played since launch).
    Idle,
    Connected,
    /// Discord isn't running (or its IPC socket can't be reached).
    DiscordNotFound,
    /// Discord answered with an error to the last activity.
    Rejected,
}

/// Handle to the presence thread (managed state).
pub struct Presence {
    tx: Mutex<Sender<Option<CleanPresence>>>,
    status: std::sync::Arc<Mutex<PresenceStatus>>,
}

impl Presence {
    pub fn set(&self, activity: Option<PresencePayload>) {
        let _ = self.tx.lock().unwrap().send(activity.map(sanitize));
    }
    pub fn status(&self) -> PresenceStatus {
        *self.status.lock().unwrap()
    }
}

/// Starts the thread. `None` clears the activity; the last wish is re-applied after a reconnect.
pub fn spawn() -> Presence {
    let (tx, rx) = channel::<Option<CleanPresence>>();
    let status = std::sync::Arc::new(Mutex::new(PresenceStatus::Idle));
    let shared = status.clone();
    let set_status = move |s: PresenceStatus| *shared.lock().unwrap() = s;
    std::thread::Builder::new()
        .name("discord-presence".into())
        .spawn(move || {
            let mut client = DiscordIpcClient::new(CLIENT_ID);
            let mut connected = false;
            let mut wanted: Option<CleanPresence> = None;
            let mut dirty = false;
            loop {
                match rx.recv_timeout(RETRY) {
                    Ok(next) => {
                        wanted = next;
                        dirty = true;
                    }
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
                // Nothing to show and never connected: don't bother Discord.
                if !connected && wanted.is_none() {
                    dirty = false;
                    continue;
                }
                if !connected {
                    match client.connect() {
                        Ok(()) => {
                            connected = true;
                            set_status(PresenceStatus::Connected);
                            log::info!("connected to Discord");
                            dirty = true;
                        }
                        Err(e) => {
                            set_status(PresenceStatus::DiscordNotFound);
                            log::info!("Discord not reachable ({e}), retrying in {}s", RETRY.as_secs());
                            continue; // Discord closed: retry on the next tick.
                        }
                    }
                }
                if dirty {
                    let res = match &wanted {
                        Some(p) => client.set_activity(to_activity(p)),
                        None => client.clear_activity(),
                    };
                    // Discord answers every command; an ERROR event means the activity was refused.
                    let res = res.and_then(|()| client.recv()).map(|(_, reply)| {
                        if reply["evt"] == "ERROR" {
                            log::warn!("Discord refused the activity: {}", reply["data"]);
                            set_status(PresenceStatus::Rejected);
                        } else {
                            set_status(PresenceStatus::Connected);
                            log::info!("Discord activity {}", if wanted.is_some() { "set" } else { "cleared" });
                        }
                    });
                    if let Err(e) = res {
                        log::warn!("Discord presence failed, reconnecting: {e}");
                        let _ = client.close();
                        connected = false;
                        set_status(PresenceStatus::DiscordNotFound);
                        continue;
                    }
                    dirty = false;
                }
            }
            let _ = client.close();
        })
        .expect("spawn presence thread");
    Presence { tx: Mutex::new(tx), status }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload() -> PresencePayload {
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

    /// Real Discord round trip (sets « Test SAKURA » for ~3 s): `cargo test live_discord -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn live_discord() {
        let p = spawn();
        p.set(Some(PresencePayload { details: "Test SAKURA".into(), ..payload() }));
        std::thread::sleep(Duration::from_secs(3));
        println!("status after set: {:?}", p.status());
        p.set(None);
        std::thread::sleep(Duration::from_secs(1));
        println!("status after clear: {:?}", p.status());
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
