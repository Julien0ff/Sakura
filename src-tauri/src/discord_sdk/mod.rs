//! Safe layer over the Discord Social SDK (mobile Discord status). A `Client` lives on one thread
//! (`discord_mobile`), which also calls `run_callbacks`: SDK callbacks then run on that thread and
//! report back as `Event`s through a channel.

mod ffi;

use std::ffi::c_void;
use std::sync::mpsc::Sender;

use crate::presence_model::CleanPresence;
use ffi::*;

#[derive(Debug, Clone, PartialEq)]
pub enum Event {
    /// `Discord_Client_Status` (0 disconnected … 3 ready).
    Status(i32),
    /// Authorization finished: (code, redirect URI) or an error.
    Authorized(Result<(String, String), String>),
    TokenSet(Result<(), String>),
    PresenceSet(Result<(), String>),
}

pub const STATUS_READY: i32 = ffi::STATUS_READY;

/// Borrowed string for the SDK (it copies what it keeps).
fn borrowed(s: &str) -> Discord_String {
    Discord_String { ptr: s.as_ptr() as *mut u8, size: s.len() }
}

/// String owned by us (return value / callback argument): copied, then released.
unsafe fn take(s: Discord_String) -> String {
    if s.ptr.is_null() {
        return String::new();
    }
    let out = String::from_utf8_lossy(unsafe { std::slice::from_raw_parts(s.ptr, s.size) }).into_owned();
    unsafe { Discord_Free(s.ptr as *mut c_void) };
    out
}

/// Reads and releases a callback's `ClientResult`.
unsafe fn result(r: *mut Discord_ClientResult) -> Result<(), String> {
    if r.is_null() {
        return Err("no result".into());
    }
    let out = if unsafe { Discord_ClientResult_Successful(r) } {
        Ok(())
    } else {
        let mut s = Discord_String { ptr: std::ptr::null_mut(), size: 0 };
        unsafe { Discord_ClientResult_Error(r, &mut s) };
        Err(unsafe { take(s) })
    };
    unsafe { Discord_ClientResult_Drop(r) };
    out
}

// ───────── Callbacks: user data = Box<Sender<Event>>, released by the SDK through drop_sender ─────────

fn user_data(tx: &Sender<Event>) -> *mut c_void {
    Box::into_raw(Box::new(tx.clone())) as *mut c_void
}

unsafe extern "C" fn drop_sender(ptr: *mut c_void) {
    if !ptr.is_null() {
        drop(unsafe { Box::from_raw(ptr as *mut Sender<Event>) });
    }
}

unsafe fn sender<'a>(ptr: *mut c_void) -> &'a Sender<Event> {
    unsafe { &*(ptr as *const Sender<Event>) }
}

unsafe extern "C" fn on_authorized(r: *mut Discord_ClientResult, code: Discord_String, redirect: Discord_String, ud: *mut c_void) {
    let (code, redirect) = unsafe { (take(code), take(redirect)) };
    let event = unsafe { result(r) }.map(|()| (code, redirect));
    let _ = unsafe { sender(ud) }.send(Event::Authorized(event));
}

unsafe extern "C" fn on_token_set(r: *mut Discord_ClientResult, ud: *mut c_void) {
    let event = unsafe { result(r) };
    let _ = unsafe { sender(ud) }.send(Event::TokenSet(event));
}

unsafe extern "C" fn on_presence_set(r: *mut Discord_ClientResult, ud: *mut c_void) {
    let event = unsafe { result(r) };
    let _ = unsafe { sender(ud) }.send(Event::PresenceSet(event));
}

unsafe extern "C" fn on_status(status: i32, _error: i32, _detail: i32, ud: *mut c_void) {
    let _ = unsafe { sender(ud) }.send(Event::Status(status));
}

/// Runs the SDK's pending callbacks on the calling thread.
pub fn run_callbacks() {
    unsafe { Discord_RunCallbacks() };
}

/// The SDK client. Not Send: create and use it on one thread only.
pub struct Client {
    // Boxed: the SDK keeps pointers to it.
    raw: Box<Discord_Client>,
    tx: Sender<Event>,
    _not_send: std::marker::PhantomData<*mut ()>,
}

impl Client {
    pub fn new(application_id: u64, tx: Sender<Event>) -> Self {
        let mut raw = Box::new(Handle::empty());
        unsafe {
            Discord_Client_Init(&mut *raw);
            Discord_Client_SetApplicationId(&mut *raw, application_id);
            Discord_Client_SetStatusChangedCallback(&mut *raw, Some(on_status), Some(drop_sender), user_data(&tx));
        }
        Self { raw, tx, _not_send: std::marker::PhantomData }
    }

    pub fn status(&mut self) -> i32 {
        unsafe { Discord_Client_GetStatus(&mut *self.raw) }
    }

    /// Opens Discord's « Authorize SAKURA » screen (Discord app or browser). Returns the PKCE
    /// verifier for the code exchange; the code arrives as `Event::Authorized`.
    pub fn authorize(&mut self, application_id: u64) -> String {
        unsafe {
            let mut verifier = Handle::empty();
            Discord_Client_CreateAuthorizationCodeVerifier(&mut *self.raw, &mut verifier);
            let mut challenge = Handle::empty();
            Discord_AuthorizationCodeVerifier_Challenge(&mut verifier, &mut challenge);
            let mut verifier_str = Discord_String { ptr: std::ptr::null_mut(), size: 0 };
            Discord_AuthorizationCodeVerifier_Verifier(&mut verifier, &mut verifier_str);

            let mut scopes = Discord_String { ptr: std::ptr::null_mut(), size: 0 };
            Discord_Client_GetDefaultPresenceScopes(&mut scopes);
            let scopes = take(scopes);

            let mut args = Handle::empty();
            Discord_AuthorizationArgs_Init(&mut args);
            Discord_AuthorizationArgs_SetClientId(&mut args, application_id);
            Discord_AuthorizationArgs_SetScopes(&mut args, borrowed(&scopes));
            Discord_AuthorizationArgs_SetCodeChallenge(&mut args, &mut challenge);
            Discord_Client_Authorize(&mut *self.raw, &mut args, Some(on_authorized), Some(drop_sender), user_data(&self.tx));

            Discord_AuthorizationArgs_Drop(&mut args);
            Discord_AuthorizationCodeChallenge_Drop(&mut challenge);
            Discord_AuthorizationCodeVerifier_Drop(&mut verifier);
            take(verifier_str)
        }
    }

    /// Bearer access token from the code exchange; then `connect`.
    pub fn update_token(&mut self, access_token: &str) {
        unsafe {
            Discord_Client_UpdateToken(&mut *self.raw, TOKEN_TYPE_BEARER, borrowed(access_token), Some(on_token_set), Some(drop_sender), user_data(&self.tx));
        }
    }

    pub fn connect(&mut self) {
        unsafe { Discord_Client_Connect(&mut *self.raw) };
    }

    pub fn disconnect(&mut self) {
        unsafe { Discord_Client_Disconnect(&mut *self.raw) };
    }

    /// Same content as the PC status: « Regarde » + details / state, images, start → end.
    pub fn set_activity(&mut self, p: &CleanPresence) {
        unsafe {
            let mut activity = Handle::empty();
            Discord_Activity_Init(&mut activity);
            Discord_Activity_SetName(&mut activity, borrowed("SAKURA"));
            Discord_Activity_SetType(&mut activity, ACTIVITY_TYPE_WATCHING);
            let mut details = borrowed(&p.details);
            Discord_Activity_SetDetails(&mut activity, &mut details);
            let mut state = borrowed(&p.state);
            Discord_Activity_SetState(&mut activity, &mut state);
            let mut display = if p.show_app_name { STATUS_DISPLAY_NAME } else { STATUS_DISPLAY_DETAILS };
            Discord_Activity_SetStatusDisplayType(&mut activity, &mut display);

            let mut assets = Handle::empty();
            Discord_ActivityAssets_Init(&mut assets);
            if let Some(img) = &p.large_image {
                let mut s = borrowed(img);
                Discord_ActivityAssets_SetLargeImage(&mut assets, &mut s);
            }
            let mut large_text = borrowed(&p.large_text);
            Discord_ActivityAssets_SetLargeText(&mut assets, &mut large_text);
            if let Some(img) = &p.small_image {
                let mut s = borrowed(img);
                Discord_ActivityAssets_SetSmallImage(&mut assets, &mut s);
            }
            let mut small_text = borrowed(&p.small_text);
            Discord_ActivityAssets_SetSmallText(&mut assets, &mut small_text);
            Discord_Activity_SetAssets(&mut activity, &mut assets);

            let mut timestamps = Handle::empty();
            if let Some(start) = p.start {
                Discord_ActivityTimestamps_Init(&mut timestamps);
                Discord_ActivityTimestamps_SetStart(&mut timestamps, start as u64 * 1000);
                if let Some(end) = p.end {
                    Discord_ActivityTimestamps_SetEnd(&mut timestamps, end as u64 * 1000);
                }
                Discord_Activity_SetTimestamps(&mut activity, &mut timestamps);
            }

            Discord_Client_UpdateRichPresence(&mut *self.raw, &mut activity, Some(on_presence_set), Some(drop_sender), user_data(&self.tx));

            if !timestamps.opaque.is_null() {
                Discord_ActivityTimestamps_Drop(&mut timestamps);
            }
            Discord_ActivityAssets_Drop(&mut assets);
            Discord_Activity_Drop(&mut activity);
        }
    }

    pub fn clear_activity(&mut self) {
        unsafe { Discord_Client_ClearRichPresence(&mut *self.raw) };
    }
}

impl Drop for Client {
    fn drop(&mut self) {
        unsafe { Discord_Client_Drop(&mut *self.raw) };
    }
}

/// Runs against the real SDK library on Linux:
/// `DISCORD_SOCIAL_SDK_LIB=<sdk>/lib/release cargo test --features social-sdk-test discord_sdk`.
#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use crate::presence_model::{sanitize, tests::payload};
    use std::sync::mpsc::channel;

    #[test]
    fn client_starts_disconnected() {
        let (tx, _rx) = channel();
        let mut c = Client::new(1568341036894523432, tx);
        run_callbacks();
        assert_eq!(c.status(), STATUS_DISCONNECTED);
    }

    #[test]
    fn pkce_verifier_and_challenge_are_distinct_strings() {
        let (tx, _rx) = channel();
        let mut c = Client::new(1568341036894523432, tx);
        unsafe {
            let mut verifier = Handle::empty();
            Discord_Client_CreateAuthorizationCodeVerifier(&mut *c.raw, &mut verifier);
            let mut challenge = Handle::empty();
            Discord_AuthorizationCodeVerifier_Challenge(&mut verifier, &mut challenge);
            let mut v = Discord_String { ptr: std::ptr::null_mut(), size: 0 };
            Discord_AuthorizationCodeVerifier_Verifier(&mut verifier, &mut v);
            let mut ch = Discord_String { ptr: std::ptr::null_mut(), size: 0 };
            Discord_AuthorizationCodeChallenge_Challenge(&mut challenge, &mut ch);
            let (v, ch) = (take(v), take(ch));
            Discord_AuthorizationCodeChallenge_Drop(&mut challenge);
            Discord_AuthorizationCodeVerifier_Drop(&mut verifier);
            // RFC 7636: 43–128 characters.
            assert!((43..=128).contains(&v.len()), "verifier {v:?}");
            assert!(!ch.is_empty() && ch != v);
        }
    }

    #[test]
    fn default_presence_scopes_are_returned() {
        let mut s = Discord_String { ptr: std::ptr::null_mut(), size: 0 };
        unsafe { Discord_Client_GetDefaultPresenceScopes(&mut s) };
        let scopes = unsafe { take(s) };
        assert!(!scopes.is_empty(), "scopes: {scopes:?}");
        println!("presence scopes: {scopes}");
    }

    #[test]
    fn activity_can_be_built_and_sent_while_disconnected() {
        let (tx, rx) = channel();
        let mut c = Client::new(1568341036894523432, tx);
        c.set_activity(&sanitize(payload()));
        c.clear_activity();
        for _ in 0..20 {
            run_callbacks();
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        // Not connected: the SDK answers with an error, which must come back as an event.
        let events: Vec<Event> = rx.try_iter().collect();
        println!("events: {events:?}");
        assert!(events.iter().all(|e| matches!(e, Event::PresenceSet(_) | Event::Status(_))));
    }
}
