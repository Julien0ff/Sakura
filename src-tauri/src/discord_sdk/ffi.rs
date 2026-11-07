//! Raw bindings to the Discord Social SDK C API (`cdiscord.h`, SDK 1.10): only what the Discord
//! status needs. Every SDK object is a struct holding one opaque pointer, initialised by `*_Init`
//! and released by `*_Drop`. Strings passed in are borrowed (copied by the SDK); strings returned
//! (return values and callback arguments) belong to the caller and are released with `Discord_Free`.
#![allow(non_snake_case, non_camel_case_types, dead_code)]

use std::ffi::c_void;

#[repr(C)]
pub struct Handle {
    pub opaque: *mut c_void,
}

impl Handle {
    pub const fn empty() -> Self {
        Self { opaque: std::ptr::null_mut() }
    }
}

pub type Discord_Client = Handle;
pub type Discord_ClientResult = Handle;
pub type Discord_AuthorizationArgs = Handle;
pub type Discord_AuthorizationCodeVerifier = Handle;
pub type Discord_AuthorizationCodeChallenge = Handle;
pub type Discord_Activity = Handle;
pub type Discord_ActivityTimestamps = Handle;
pub type Discord_ActivityAssets = Handle;

#[repr(C)]
#[derive(Clone, Copy)]
pub struct Discord_String {
    pub ptr: *mut u8,
    pub size: usize,
}

pub type Discord_FreeFn = Option<unsafe extern "C" fn(ptr: *mut c_void)>;

// Enums are C ints (`*_forceint = 0x7FFFFFFF`).
pub const ACTIVITY_TYPE_WATCHING: i32 = 3;
pub const STATUS_DISPLAY_NAME: i32 = 0;
pub const STATUS_DISPLAY_DETAILS: i32 = 2;
pub const TOKEN_TYPE_BEARER: i32 = 1;
pub const STATUS_DISCONNECTED: i32 = 0;
pub const STATUS_READY: i32 = 3;

pub type AuthorizationCallback =
    Option<unsafe extern "C" fn(result: *mut Discord_ClientResult, code: Discord_String, redirect_uri: Discord_String, user_data: *mut c_void)>;
pub type ResultCallback = Option<unsafe extern "C" fn(result: *mut Discord_ClientResult, user_data: *mut c_void)>;
pub type StatusChangedCallback = Option<unsafe extern "C" fn(status: i32, error: i32, error_detail: i32, user_data: *mut c_void)>;

unsafe extern "C" {
    pub fn Discord_Free(ptr: *mut c_void);
    pub fn Discord_RunCallbacks();

    pub fn Discord_Client_Init(this: *mut Discord_Client);
    pub fn Discord_Client_Drop(this: *mut Discord_Client);
    pub fn Discord_Client_SetApplicationId(this: *mut Discord_Client, application_id: u64);
    pub fn Discord_Client_GetStatus(this: *mut Discord_Client) -> i32;
    pub fn Discord_Client_GetDefaultPresenceScopes(return_value: *mut Discord_String);
    pub fn Discord_Client_CreateAuthorizationCodeVerifier(this: *mut Discord_Client, return_value: *mut Discord_AuthorizationCodeVerifier);
    pub fn Discord_Client_Authorize(
        this: *mut Discord_Client,
        args: *mut Discord_AuthorizationArgs,
        callback: AuthorizationCallback,
        user_data_free: Discord_FreeFn,
        user_data: *mut c_void,
    );
    pub fn Discord_Client_UpdateToken(
        this: *mut Discord_Client,
        token_type: i32,
        token: Discord_String,
        callback: ResultCallback,
        user_data_free: Discord_FreeFn,
        user_data: *mut c_void,
    );
    pub fn Discord_Client_Connect(this: *mut Discord_Client);
    pub fn Discord_Client_Disconnect(this: *mut Discord_Client);
    pub fn Discord_Client_SetStatusChangedCallback(
        this: *mut Discord_Client,
        callback: StatusChangedCallback,
        user_data_free: Discord_FreeFn,
        user_data: *mut c_void,
    );
    pub fn Discord_Client_UpdateRichPresence(
        this: *mut Discord_Client,
        activity: *mut Discord_Activity,
        callback: ResultCallback,
        user_data_free: Discord_FreeFn,
        user_data: *mut c_void,
    );
    pub fn Discord_Client_ClearRichPresence(this: *mut Discord_Client);

    pub fn Discord_ClientResult_Successful(this: *mut Discord_ClientResult) -> bool;
    pub fn Discord_ClientResult_Error(this: *mut Discord_ClientResult, return_value: *mut Discord_String);
    pub fn Discord_ClientResult_Drop(this: *mut Discord_ClientResult);

    pub fn Discord_AuthorizationCodeVerifier_Challenge(this: *mut Discord_AuthorizationCodeVerifier, return_value: *mut Discord_AuthorizationCodeChallenge);
    pub fn Discord_AuthorizationCodeVerifier_Verifier(this: *mut Discord_AuthorizationCodeVerifier, return_value: *mut Discord_String);
    pub fn Discord_AuthorizationCodeVerifier_Drop(this: *mut Discord_AuthorizationCodeVerifier);
    pub fn Discord_AuthorizationCodeChallenge_Challenge(this: *mut Discord_AuthorizationCodeChallenge, return_value: *mut Discord_String);
    pub fn Discord_AuthorizationCodeChallenge_Drop(this: *mut Discord_AuthorizationCodeChallenge);

    pub fn Discord_AuthorizationArgs_Init(this: *mut Discord_AuthorizationArgs);
    pub fn Discord_AuthorizationArgs_Drop(this: *mut Discord_AuthorizationArgs);
    pub fn Discord_AuthorizationArgs_SetClientId(this: *mut Discord_AuthorizationArgs, value: u64);
    pub fn Discord_AuthorizationArgs_SetScopes(this: *mut Discord_AuthorizationArgs, value: Discord_String);
    pub fn Discord_AuthorizationArgs_SetCodeChallenge(this: *mut Discord_AuthorizationArgs, value: *mut Discord_AuthorizationCodeChallenge);

    pub fn Discord_Activity_Init(this: *mut Discord_Activity);
    pub fn Discord_Activity_Drop(this: *mut Discord_Activity);
    pub fn Discord_Activity_SetName(this: *mut Discord_Activity, value: Discord_String);
    pub fn Discord_Activity_SetType(this: *mut Discord_Activity, value: i32);
    pub fn Discord_Activity_SetDetails(this: *mut Discord_Activity, value: *mut Discord_String);
    pub fn Discord_Activity_SetState(this: *mut Discord_Activity, value: *mut Discord_String);
    pub fn Discord_Activity_SetStatusDisplayType(this: *mut Discord_Activity, value: *mut i32);
    pub fn Discord_Activity_SetTimestamps(this: *mut Discord_Activity, value: *mut Discord_ActivityTimestamps);
    pub fn Discord_Activity_SetAssets(this: *mut Discord_Activity, value: *mut Discord_ActivityAssets);

    pub fn Discord_ActivityTimestamps_Init(this: *mut Discord_ActivityTimestamps);
    pub fn Discord_ActivityTimestamps_Drop(this: *mut Discord_ActivityTimestamps);
    pub fn Discord_ActivityTimestamps_SetStart(this: *mut Discord_ActivityTimestamps, value: u64);
    pub fn Discord_ActivityTimestamps_SetEnd(this: *mut Discord_ActivityTimestamps, value: u64);

    pub fn Discord_ActivityAssets_Init(this: *mut Discord_ActivityAssets);
    pub fn Discord_ActivityAssets_Drop(this: *mut Discord_ActivityAssets);
    pub fn Discord_ActivityAssets_SetLargeImage(this: *mut Discord_ActivityAssets, value: *mut Discord_String);
    pub fn Discord_ActivityAssets_SetLargeText(this: *mut Discord_ActivityAssets, value: *mut Discord_String);
    pub fn Discord_ActivityAssets_SetSmallImage(this: *mut Discord_ActivityAssets, value: *mut Discord_String);
    pub fn Discord_ActivityAssets_SetSmallText(this: *mut Discord_ActivityAssets, value: *mut Discord_String);
}
