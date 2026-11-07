//! Discord Rich Presence: a dedicated thread owns the IPC connection, remembers the activity
//! the site asked for, and (re)connects while Discord is not running.

use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::time::Duration;

use discord_rich_presence::activity::{Activity, ActivityType, Assets, Button, StatusDisplayType, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};

use crate::presence_model::{sanitize, CleanPresence, CLIENT_ID};
pub use crate::presence_model::PresencePayload;

const RETRY: Duration = Duration::from_secs(15);

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
    use crate::presence_model::tests::payload;

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

}
