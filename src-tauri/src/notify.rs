//! Release notifications: every 15 min, new episodes of the followed anime (VOSTFR: AniList airing
//! schedule; VF: the site's /api/planning) become system notifications, even with the window hidden.

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt as _;

use crate::shell::site_url;

const FIRST_CHECK: Duration = Duration::from_secs(60);
const EVERY: Duration = Duration::from_secs(15 * 60);
/// App closed for days: only the last 2 days of releases are announced.
pub const MAX_BACKLOG: i64 = 2 * 86_400;
/// Placeholder hour of releases without a time (23:59 Paris): announce them from 00:00.
const UNKNOWN_HOUR_SHIFT: i64 = 23 * 3600 + 59 * 60;
const SEEN_LIMIT: usize = 500;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TargetAnime {
    pub id: i64,
    pub title: String,
}

/// Sent by the site (src/lib/notify-targets.ts) and persisted.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Targets {
    pub anime: Vec<TargetAnime>,
    pub langs: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Airing {
    pub media_id: i64,
    pub episode: i64,
    pub airing_at: i64,
}

#[derive(Debug, Clone)]
pub struct PlanItem {
    pub anilist_id: Option<i64>,
    pub lang: String,
    pub label: Option<String>,
    pub airing_at: i64,
    pub time_unknown: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Notice {
    pub key: String,
    pub title: String,
    pub body: String,
}

/// Start of the check window: first run sets a baseline (no backlog), long gaps are capped.
pub fn window_start(last_check: i64, now: i64) -> i64 {
    if last_check <= 0 {
        now
    } else {
        last_check.max(now - MAX_BACKLOG)
    }
}

/// Releases in (from, now] for followed anime and languages, minus those already announced.
pub fn due(targets: &Targets, airing: &[Airing], planning: &[PlanItem], from: i64, now: i64, seen: &[String]) -> Vec<Notice> {
    let title = |id: i64| targets.anime.iter().find(|a| a.id == id).map(|a| a.title.clone());
    let wants = |lang: &str| targets.langs.iter().any(|l| l == lang);
    let fresh = |key: &str| !seen.iter().any(|k| k == key);
    let in_window = |at: i64| at > from && at <= now;
    let mut out = Vec::new();

    if wants("vostfr") {
        for a in airing {
            let key = format!("a:{}:{}", a.media_id, a.episode);
            if let (Some(t), true, true) = (title(a.media_id), in_window(a.airing_at), fresh(&key)) {
                out.push(Notice { key, title: t, body: format!("L’épisode {} est disponible en VOSTFR.", a.episode) });
            }
        }
    }
    if wants("vf") {
        for p in planning.iter().filter(|p| p.lang == "vf") {
            let Some(id) = p.anilist_id else { continue };
            let at = if p.time_unknown { p.airing_at - UNKNOWN_HOUR_SHIFT } else { p.airing_at };
            let key = format!("v:{}:{}", id, p.airing_at);
            if let (Some(t), true, true) = (title(id), in_window(at), fresh(&key)) {
                let body = match &p.label {
                    Some(l) => format!("Nouvel épisode en VF ({l})."),
                    None => "Nouvel épisode en VF.".to_string(),
                };
                out.push(Notice { key, title: t, body });
            }
        }
    }
    out
}

// ───────── Persistence ─────────

#[derive(Debug, Default, Serialize, Deserialize)]
struct CheckState {
    last_check: i64,
    seen: Vec<String>,
}

pub struct NotifyState {
    targets: Mutex<Targets>,
}

fn data_file(app: &AppHandle, name: &str) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(name))
}

fn load<T: for<'de> Deserialize<'de> + Default>(app: &AppHandle, name: &str) -> T {
    data_file(app, name)
        .and_then(|p| std::fs::read(p).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn save<T: Serialize>(app: &AppHandle, name: &str, value: &T) {
    if let (Some(p), Ok(b)) = (data_file(app, name), serde_json::to_vec(value)) {
        let _ = std::fs::write(p, b);
    }
}

const TARGETS_FILE: &str = "notify-targets.json";
const STATE_FILE: &str = "notify-state.json";

impl NotifyState {
    pub fn load(app: &AppHandle) -> Self {
        Self { targets: Mutex::new(load(app, TARGETS_FILE)) }
    }
    pub fn set(&self, app: &AppHandle, targets: Targets) {
        save(app, TARGETS_FILE, &targets);
        *self.targets.lock().unwrap() = targets;
    }
    fn get(&self) -> Targets {
        self.targets.lock().unwrap().clone()
    }
}

// ───────── Fetching ─────────

fn unix_now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

#[derive(Deserialize)]
struct AniResponse {
    data: Option<AniData>,
}
#[derive(Deserialize)]
struct AniData {
    #[serde(rename = "Page")]
    page: AniPage,
}
#[derive(Deserialize)]
struct AniPage {
    #[serde(rename = "airingSchedules")]
    airing_schedules: Vec<AniAiring>,
}
#[derive(Deserialize)]
struct AniAiring {
    episode: i64,
    #[serde(rename = "airingAt")]
    airing_at: i64,
    #[serde(rename = "mediaId")]
    media_id: i64,
}

async fn fetch_airing(client: &reqwest::Client, ids: &[i64], from: i64, now: i64) -> Result<Vec<Airing>, reqwest::Error> {
    let query = "query ($ids: [Int], $from: Int, $to: Int) { Page(perPage: 50) { airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) { episode airingAt mediaId } } }";
    let body = serde_json::json!({ "query": query, "variables": { "ids": ids, "from": from, "to": now + 1 } });
    let res: AniResponse = client.post("https://graphql.anilist.co").json(&body).send().await?.error_for_status()?.json().await?;
    Ok(res
        .data
        .map(|d| d.page.airing_schedules.into_iter().map(|a| Airing { media_id: a.media_id, episode: a.episode, airing_at: a.airing_at }).collect())
        .unwrap_or_default())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApiPlanItem {
    lang: String,
    label: Option<String>,
    airing_at: i64,
    time: Option<String>,
    anilist: Option<ApiMedia>,
}
#[derive(Deserialize)]
struct ApiMedia {
    id: i64,
}

async fn fetch_planning(client: &reqwest::Client) -> Result<Vec<PlanItem>, reqwest::Error> {
    let url = site_url().join("/api/planning").expect("planning url");
    let items: Vec<ApiPlanItem> = client.get(url).send().await?.error_for_status()?.json().await?;
    Ok(items
        .into_iter()
        .map(|p| PlanItem { anilist_id: p.anilist.map(|m| m.id), lang: p.lang, label: p.label, airing_at: p.airing_at, time_unknown: p.time.is_none() })
        .collect())
}

async fn check_once(app: &AppHandle, client: &reqwest::Client) {
    let targets = app.state::<NotifyState>().get();
    let mut state: CheckState = load(app, STATE_FILE);
    let now = unix_now();
    let from = window_start(state.last_check, now);
    if targets.anime.is_empty() || targets.langs.is_empty() || from >= now {
        state.last_check = now;
        save(app, STATE_FILE, &state);
        return;
    }
    let ids: Vec<i64> = targets.anime.iter().map(|a| a.id).collect();
    let wants = |l: &str| targets.langs.iter().any(|x| x == l);
    let airing = if wants("vostfr") { fetch_airing(client, &ids, from, now).await } else { Ok(vec![]) };
    let planning = if wants("vf") { fetch_planning(client).await } else { Ok(vec![]) };
    // Offline / API down: keep the window open, retry next tick.
    let (Ok(airing), Ok(planning)) = (airing, planning) else {
        log::warn!("release check failed, will retry");
        return;
    };
    for n in due(&targets, &airing, &planning, from, now, &state.seen) {
        log::info!("release notification: {}", n.key);
        let _ = app.notification().builder().title(&n.title).body(&n.body).show();
        state.seen.push(n.key);
    }
    let excess = state.seen.len().saturating_sub(SEEN_LIMIT);
    state.seen.drain(..excess);
    state.last_check = now;
    save(app, STATE_FILE, &state);
}

/// Background loop (first check after 1 min, then every 15 min).
pub fn spawn_checks(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Ok(client) = reqwest::Client::builder().timeout(Duration::from_secs(20)).user_agent("SAKURA desktop").build() else {
            return;
        };
        tokio::time::sleep(FIRST_CHECK).await;
        loop {
            check_once(&app, &client).await;
            tokio::time::sleep(EVERY).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn targets(langs: &[&str]) -> Targets {
        Targets {
            anime: vec![TargetAnime { id: 1, title: "Blue Box".into() }, TargetAnime { id: 2, title: "Frieren".into() }],
            langs: langs.iter().map(|s| s.to_string()).collect(),
        }
    }
    fn airing(id: i64, ep: i64, at: i64) -> Airing {
        Airing { media_id: id, episode: ep, airing_at: at }
    }
    fn vf(id: Option<i64>, at: i64, unknown: bool) -> PlanItem {
        PlanItem { anilist_id: id, lang: "vf".into(), label: Some("Saison 2".into()), airing_at: at, time_unknown: unknown }
    }

    #[test]
    fn vostfr_episodes_in_the_window_for_followed_anime() {
        let n = due(&targets(&["vostfr"]), &[airing(1, 12, 150), airing(3, 4, 150), airing(2, 1, 90)], &[], 100, 200, &[]);
        assert_eq!(n.len(), 1);
        assert_eq!(n[0].key, "a:1:12");
        assert_eq!(n[0].title, "Blue Box");
        assert_eq!(n[0].body, "L’épisode 12 est disponible en VOSTFR.");
    }

    #[test]
    fn vf_releases_matched_by_anilist_id() {
        let n = due(&targets(&["vf"]), &[airing(1, 12, 150)], &[vf(Some(2), 150, false), vf(None, 150, false), vf(Some(9), 150, false)], 100, 200, &[]);
        assert_eq!(n.len(), 1);
        assert_eq!(n[0].title, "Frieren");
        assert_eq!(n[0].body, "Nouvel épisode en VF (Saison 2).");
    }

    #[test]
    fn unknown_hour_counts_from_the_start_of_the_day() {
        // 23:59 placeholder: due from 00:00 the same day (23 h 59 earlier).
        let at = 100_000;
        let n = due(&targets(&["vf"]), &[], &[vf(Some(1), at, true)], at - 86_400, at - 86_300, &[]);
        assert_eq!(n.len(), 1);
        // Before midnight: not yet.
        let n = due(&targets(&["vf"]), &[], &[vf(Some(1), at, true)], at - 86_500, at - 86_400, &[]);
        assert!(n.is_empty());
        let n = due(&targets(&["vf"]), &[], &[vf(Some(1), at, true)], at - 86_400, at - 86_300, &[]);
        assert_eq!(n.len(), 1);
    }

    #[test]
    fn already_seen_and_unfollowed_languages_are_skipped() {
        let n = due(&targets(&["vostfr"]), &[airing(1, 12, 150)], &[vf(Some(1), 150, false)], 100, 200, &["a:1:12".to_string()]);
        assert!(n.is_empty());
    }

    #[test]
    fn window_start_is_capped_and_first_run_only_sets_a_baseline() {
        assert_eq!(window_start(0, 1_000_000), 1_000_000);
        assert_eq!(window_start(10, 1_000_000), 1_000_000 - MAX_BACKLOG);
        assert_eq!(window_start(999_000, 1_000_000), 999_000);
    }
}
