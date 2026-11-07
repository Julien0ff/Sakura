//! Pure helpers: deep links and external URLs.

use serde::Serialize;
use url::Url;

/// Production site loaded by the main window.
pub const PROD_URL: &str = "https://sakura.thefoxy.me";
/// Next.js dev server (debug builds).
pub const DEV_URL: &str = "http://localhost:3000";

/// OAuth result carried by `sakura://auth/callback?…`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AuthLink {
    pub code: Option<String>,
    pub next: Option<String>,
    pub error: Option<String>,
}

/// Parses a sign-in deep link; anything else returns `None`.
pub fn parse_auth_link(raw: &str) -> Option<AuthLink> {
    let url = Url::parse(raw).ok()?;
    if url.scheme() != "sakura" || url.host_str() != Some("auth") || url.path() != "/callback" {
        return None;
    }
    let get = |key: &str| url.query_pairs().find(|(k, _)| k == key).map(|(_, v)| v.into_owned()).filter(|v| !v.is_empty());
    Some(AuthLink {
        code: get("code"),
        next: get("next"),
        error: get("error_description").or_else(|| get("error")),
    })
}

/// Launch argument passed by « Lancer au démarrage »: start in the tray, window hidden.
pub const AUTOSTART_FLAG: &str = "--minimized";

pub fn starts_hidden(args: &[String]) -> bool {
    args.iter().any(|a| a == AUTOSTART_FLAG)
}

/// Only `https:` URLs with a host may be opened in the system browser.
pub fn is_allowed_external(raw: &str) -> bool {
    Url::parse(raw).map(|u| u.scheme() == "https" && u.host_str().is_some_and(|h| !h.is_empty())).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_callback_with_code_and_next() {
        let l = parse_auth_link("sakura://auth/callback?code=abc&next=%2Fanime%3Fid%3D1").unwrap();
        assert_eq!(l.code.as_deref(), Some("abc"));
        assert_eq!(l.next.as_deref(), Some("/anime?id=1"));
        assert_eq!(l.error, None);
    }

    #[test]
    fn ignores_other_links() {
        assert!(parse_auth_link("sakura://other?code=a").is_none());
        assert!(parse_auth_link("https://sakura.thefoxy.me/auth/callback?code=a").is_none());
        assert!(parse_auth_link("not a url").is_none());
    }

    #[test]
    fn prefers_error_description() {
        let l = parse_auth_link("sakura://auth/callback?error=access_denied&error_description=Refus%C3%A9").unwrap();
        assert_eq!(l.error.as_deref(), Some("Refusé"));
        let l = parse_auth_link("sakura://auth/callback?error=access_denied").unwrap();
        assert_eq!(l.error.as_deref(), Some("access_denied"));
    }

    #[test]
    fn autostart_flag_starts_hidden() {
        let args = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(starts_hidden(&args(&["sakura", "--minimized"])));
        assert!(!starts_hidden(&args(&["sakura"])));
        assert!(!starts_hidden(&args(&["sakura", "sakura://auth/callback?code=a"])));
    }

    #[test]
    fn only_https_is_external() {
        assert!(is_allowed_external("https://discord.com/oauth2/authorize?x=1"));
        assert!(!is_allowed_external("http://example.com"));
        assert!(!is_allowed_external("javascript:alert(1)"));
        assert!(!is_allowed_external("file:///etc/passwd"));
        assert!(!is_allowed_external("https://"));
    }
}
