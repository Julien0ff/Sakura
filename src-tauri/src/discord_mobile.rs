//! Discord status in the mobile apps (Social SDK, see docs/superpowers/specs/2026-11-08-discord-mobile-design.md).
//! The user links their Discord account once; the code is exchanged for tokens by the site
//! (`/api/discord/token`, which holds the app secret), the refresh token is kept in the app's data,
//! and the same activity as on PC is sent while the app is open.
//! Built without the SDK (no `DISCORD_SOCIAL_SDK` at build time): status « unavailable ».
// Only wired up in the mobile apps; compiled on PC by the tests.
#![cfg_attr(not(mobile), allow(dead_code))]

use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

use crate::presence_model::PresencePayload;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LinkState {
    /// App built without the Social SDK.
    Unavailable,
    NotLinked,
    /// Discord's authorization screen is open.
    Linking,
    Connecting,
    Connected,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiscordStatus {
    pub state: LinkState,
    pub error: Option<String>,
}

/// Tokens returned by the site's `/api/discord/token`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

/// What is kept between launches.
#[derive(Debug, Default, Serialize, Deserialize)]
struct Saved {
    refresh_token: Option<String>,
}

type Shared = Arc<Mutex<DiscordStatus>>;

fn set_status(shared: &Shared, state: LinkState, error: Option<String>) {
    *shared.lock().unwrap() = DiscordStatus { state, error };
}

pub struct DiscordMobile {
    status: Shared,
    #[cfg(social_sdk)]
    tx: Mutex<std::sync::mpsc::Sender<sdk_thread::Msg>>,
}

impl DiscordMobile {
    pub fn status(&self) -> DiscordStatus {
        self.status.lock().unwrap().clone()
    }

    #[cfg(not(social_sdk))]
    pub fn spawn(_app: tauri::AppHandle) -> Self {
        Self { status: Arc::new(Mutex::new(DiscordStatus { state: LinkState::Unavailable, error: None })) }
    }
    #[cfg(not(social_sdk))]
    pub fn link(&self) -> Result<(), String> {
        Err("Statut Discord indisponible dans cette version".into())
    }
    #[cfg(not(social_sdk))]
    pub fn unlink(&self) {}
    #[cfg(not(social_sdk))]
    pub fn set(&self, _activity: Option<PresencePayload>) {}

    #[cfg(social_sdk)]
    pub fn spawn(app: tauri::AppHandle) -> Self {
        let status: Shared = Arc::new(Mutex::new(DiscordStatus { state: LinkState::NotLinked, error: None }));
        let tx = sdk_thread::spawn(app, status.clone());
        Self { status, tx: Mutex::new(tx) }
    }
    #[cfg(social_sdk)]
    pub fn link(&self) -> Result<(), String> {
        self.tx.lock().unwrap().send(sdk_thread::Msg::Link).map_err(|e| e.to_string())
    }
    #[cfg(social_sdk)]
    pub fn unlink(&self) {
        let _ = self.tx.lock().unwrap().send(sdk_thread::Msg::Unlink);
    }
    #[cfg(social_sdk)]
    pub fn set(&self, activity: Option<PresencePayload>) {
        let _ = self.tx.lock().unwrap().send(sdk_thread::Msg::Presence(activity.map(crate::presence_model::sanitize)));
    }
}

#[cfg(social_sdk)]
mod sdk_thread {
    use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    use tauri::{AppHandle, Manager};

    use super::{set_status, LinkState, Saved, Shared, Tokens};
    use crate::discord_sdk::{run_callbacks, Client, Event, STATUS_READY};
    use crate::presence_model::{CleanPresence, CLIENT_ID};
    use crate::shell::site_url;

    const TICK: Duration = Duration::from_millis(50);
    /// Refresh the access token when it has less than this left.
    const REFRESH_MARGIN: i64 = 3600;
    const FILE: &str = "discord-token.json";

    pub enum Msg {
        Link,
        Unlink,
        Presence(Option<CleanPresence>),
        /// Result of a code exchange or refresh; `from_refresh` tells a revoked link apart.
        Tokens { result: Result<Tokens, (Option<u16>, String)>, from_refresh: bool },
    }

    fn now() -> i64 {
        SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
    }

    fn file(app: &AppHandle) -> Option<std::path::PathBuf> {
        let dir = app.path().app_data_dir().ok()?;
        std::fs::create_dir_all(&dir).ok()?;
        Some(dir.join(FILE))
    }

    fn load(app: &AppHandle) -> Saved {
        file(app).and_then(|p| std::fs::read(p).ok()).and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
    }

    fn save(app: &AppHandle, saved: &Saved) {
        if let (Some(p), Ok(b)) = (file(app), serde_json::to_vec(saved)) {
            let _ = std::fs::write(p, b);
        }
    }

    /// POSTs to the site's token endpoint off the SDK thread; the answer comes back as `Msg::Tokens`.
    fn request_tokens(tx: Sender<Msg>, body: serde_json::Value, from_refresh: bool) {
        tauri::async_runtime::spawn(async move {
            let result = async {
                let url = site_url().join("/api/discord/token").map_err(|e| (None, e.to_string()))?;
                let res = reqwest::Client::new()
                    .post(url)
                    .timeout(Duration::from_secs(20))
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| (None, e.to_string()))?;
                let code = res.status();
                if !code.is_success() {
                    let msg = match code.as_u16() {
                        503 => "le site n’est pas encore configuré pour Discord".to_string(),
                        400 | 401 => "Discord a refusé l’autorisation".to_string(),
                        _ => format!("échange refusé ({code})"),
                    };
                    return Err((Some(code.as_u16()), msg));
                }
                res.json::<Tokens>().await.map_err(|e| (None, e.to_string()))
            }
            .await;
            let _ = tx.send(Msg::Tokens { result, from_refresh });
        });
    }

    pub fn spawn(app: AppHandle, status: Shared) -> Sender<Msg> {
        let (tx, rx) = channel::<Msg>();
        let own_tx = tx.clone();
        std::thread::Builder::new()
            .name("discord-sdk".into())
            .spawn(move || run(app, status, own_tx, rx))
            .expect("discord sdk thread");
        tx
    }

    fn run(app: AppHandle, status: Shared, tx: Sender<Msg>, rx: Receiver<Msg>) {
        // Android: MainActivity hands the activity to the SDK in onCreate; give it a moment.
        std::thread::sleep(Duration::from_millis(500));
        let app_id: u64 = CLIENT_ID.parse().expect("Discord application id");
        let (events_tx, events_rx) = channel::<Event>();
        let mut client = Client::new(app_id, events_tx);

        let mut saved = load(&app);
        let mut verifier: Option<String> = None;
        let mut desired: Option<CleanPresence> = None;
        let mut expires_at: i64 = 0;
        let mut ready = false;

        if let Some(refresh) = saved.refresh_token.clone() {
            set_status(&status, LinkState::Connecting, None);
            request_tokens(tx.clone(), serde_json::json!({ "refreshToken": refresh }), true);
            expires_at = i64::MAX; // a refresh is in flight
        }

        loop {
            match rx.recv_timeout(TICK) {
                Ok(Msg::Link) => {
                    if verifier.is_none() {
                        set_status(&status, LinkState::Linking, None);
                        verifier = Some(client.authorize(app_id));
                    }
                }
                Ok(Msg::Unlink) => {
                    client.clear_activity();
                    client.disconnect();
                    saved = Saved::default();
                    save(&app, &saved);
                    verifier = None;
                    ready = false;
                    expires_at = 0;
                    set_status(&status, LinkState::NotLinked, None);
                }
                Ok(Msg::Presence(p)) => {
                    desired = p;
                    if ready {
                        apply(&mut client, &desired);
                    }
                }
                Ok(Msg::Tokens { result: Ok(t), .. }) => {
                    saved.refresh_token = Some(t.refresh_token.clone());
                    save(&app, &saved);
                    expires_at = now() + t.expires_in;
                    client.update_token(&t.access_token);
                }
                Ok(Msg::Tokens { result: Err((code, e)), from_refresh }) => {
                    log::warn!("discord token request failed: {e}");
                    // Link revoked / refresh token expired: back to « Relier Discord ».
                    if from_refresh && matches!(code, Some(400 | 401)) {
                        saved = Saved::default();
                        save(&app, &saved);
                        set_status(&status, LinkState::NotLinked, None);
                    } else {
                        set_status(&status, LinkState::Error, Some(e));
                    }
                    expires_at = 0;
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => return,
            }

            run_callbacks();
            for event in events_rx.try_iter() {
                match event {
                    Event::Authorized(Ok((code, redirect_uri))) => {
                        let code_verifier = verifier.take().unwrap_or_default();
                        set_status(&status, LinkState::Connecting, None);
                        request_tokens(tx.clone(), serde_json::json!({ "code": code, "codeVerifier": code_verifier, "redirectUri": redirect_uri }), false);
                    }
                    Event::Authorized(Err(e)) => {
                        verifier = None;
                        log::warn!("discord authorization failed: {e}");
                        let linked = saved.refresh_token.is_some();
                        set_status(&status, if linked { LinkState::Connecting } else { LinkState::NotLinked }, Some(e).filter(|e| !e.is_empty()));
                    }
                    Event::TokenSet(Ok(())) => client.connect(),
                    Event::TokenSet(Err(e)) => set_status(&status, LinkState::Error, Some(e)),
                    Event::Status(s) => {
                        ready = s == STATUS_READY;
                        if ready {
                            set_status(&status, LinkState::Connected, None);
                            apply(&mut client, &desired);
                        } else if saved.refresh_token.is_some() && verifier.is_none() {
                            set_status(&status, LinkState::Connecting, None);
                        }
                    }
                    Event::PresenceSet(Err(e)) => log::warn!("discord presence rejected: {e}"),
                    Event::PresenceSet(Ok(())) => {}
                }
            }

            // Access tokens last about a week; the app may stay open that long.
            if expires_at > 0 && expires_at != i64::MAX && expires_at - now() < REFRESH_MARGIN {
                if let Some(refresh) = saved.refresh_token.clone() {
                    expires_at = i64::MAX;
                    request_tokens(tx.clone(), serde_json::json!({ "refreshToken": refresh }), true);
                }
            }
        }
    }

    fn apply(client: &mut Client, desired: &Option<CleanPresence>) {
        match desired {
            Some(p) => client.set_activity(p),
            None => client.clear_activity(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_from_the_site_endpoint() {
        let t: Tokens = serde_json::from_str(r#"{"accessToken":"a","refreshToken":"r","expiresIn":604800}"#).unwrap();
        assert_eq!((t.access_token.as_str(), t.refresh_token.as_str(), t.expires_in), ("a", "r", 604800));
    }

    #[test]
    fn status_for_the_site() {
        let s = DiscordStatus { state: LinkState::NotLinked, error: None };
        assert_eq!(serde_json::to_string(&s).unwrap(), r#"{"state":"not_linked","error":null}"#);
    }
}
