# SAKURA Desktop — Enveloppe (étape 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tauri 2 desktop app (Windows + Linux) that shows the live SAKURA site, signs in with Discord/Google through the system browser, lives in the tray, and updates itself.

**Architecture:** The Rust shell opens `https://sakura.thefoxy.me` (dev: `http://localhost:3000`) in its main window, with a bundled offline page as fallback. Only that origin gets a capability to call a small set of app commands. OAuth runs in the system browser; a server route `/auth/app` bounces the code to `sakura://auth/callback`, Rust forwards it to the webview, which finishes the PKCE exchange. Updates come from GitHub Releases.

**Tech Stack:** Tauri 2.12 (Rust 1.96), plugins `deep-link`, `single-instance` (feature `deep-link`), `window-state`, `autostart`, `updater`, `process`, `notification`, all `"2"`; `reqwest` for the connectivity probe; Next.js 16 site with `@tauri-apps/api` 2.12; Supabase JS.

**Spec:** `docs/superpowers/specs/2026-11-07-desktop-app-design.md`

## Global Constraints

- Never commit or push (the user commits). Plan "Commit" steps are replaced by "leave changes uncommitted".
- Prod origin `https://sakura.thefoxy.me`; dev origin `http://localhost:3000`; deep-link scheme `sakura`; identifier `app.sakura.desktop`.
- Only those two origins get the remote capability; app commands validate their inputs (external URLs must be `https:`).
- Site code for the app lives behind `isTauri()` and does nothing on the web.
- Windows (NSIS + MSI) and Linux (AppImage, deb, rpm) only. Native window decorations. Window 1280×800, min 960×600.
- Update check at startup and every 6 h; install only on user action. Updater endpoint `https://github.com/Julien0ff/Sakura/releases/latest/download/latest.json`.
- All UI copy in French.

## Review Focus

- A deep link arriving while the app is **not running** (cold start): the code must still reach the webview once the page has loaded (queue it in Rust until the page asks for it).
- A deep link arriving while the window is **hidden in the tray**: the window must be shown and focused.
- OAuth error return (`/auth/app?error=access_denied&error_description=…`): the app must show the error, not hang on « Connexion en cours ».
- Site loaded in a normal browser: no `@tauri-apps/*` call may throw or run; `/auth/app` opened by hand without a code shows a readable page.
- Offline at launch, then network comes back: « Réessayer » must load the site.

---

### Task 1: `/auth/app` bounce route

**Files:**
- Create: `src/lib/app-auth.ts`, `src/lib/app-auth.test.ts`
- Create: `src/app/auth/app/route.ts`

**Interfaces:**
- Produces: `appDeepLink(params: URLSearchParams): string` — returns `sakura://auth/callback?…` carrying only `code`, `next`, `error`, `error_description` (others dropped; `next` kept only if it starts with `/` and not `//`). `bouncePage(deepLink: string, hasCode: boolean): string` — full HTML document.

- [ ] **Step 1: Write the failing tests** in `src/lib/app-auth.test.ts`:
  - `appDeepLink(new URLSearchParams('code=abc&next=/anime?id=1&foo=x'))` → `'sakura://auth/callback?code=abc&next=%2Fanime%3Fid%3D1'`
  - `next=//evil.com` is dropped; `error=access_denied&error_description=Nope` is kept.
  - `bouncePage(link, true)` contains `http-equiv="refresh"` with the link, an `<a href=` with the link, and « Retournez dans SAKURA »; with `hasCode=false` and no error it contains « Lien de connexion invalide » and no refresh.
  - The link inside the HTML is attribute-escaped (`&` → `&amp;`).
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3: Implement** `src/lib/app-auth.ts` (pure, `.ts` imports only) and `route.ts`: `GET(request)` returns `new Response(bouncePage(...), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } })`. Style the page inline in SAKURA colors (black, pink `#FF7AA8`, logo `/icon.png`).
- [ ] **Step 4:** `npm test` → PASS. `curl -s 'localhost:3000/auth/app?code=x'` shows the refresh to `sakura://auth/callback?code=x`.
- [ ] **Step 5:** Leave uncommitted.

### Task 2: Rust pure helpers

**Files:**
- Create: `src-tauri/src/links.rs` (declared in `lib.rs` as `mod links;`)

**Interfaces:**
- Produces: `pub struct AuthLink { pub code: Option<String>, pub next: Option<String>, pub error: Option<String> }` (serde `Serialize`, `Clone`); `pub fn parse_auth_link(url: &str) -> Option<AuthLink>` (only `sakura://auth/callback`; `error` = `error_description` or else `error`); `pub fn is_allowed_external(url: &str) -> bool` (`https:` only, has host); `pub const PROD_URL`, `DEV_URL`.

- [ ] **Step 1: Write failing `#[cfg(test)]` tests** in `links.rs`: callback with code+next parsed; `sakura://other` → None; `https://…` → None; error_description preferred over error; `is_allowed_external("https://discord.com/oauth2")` true, `http://…`, `javascript:…`, `file:///…` false.
- [ ] **Step 2:** `cd src-tauri && cargo test links` → FAIL.
- [ ] **Step 3: Implement** with `url::Url` (add `url = "2"` to Cargo.toml).
- [ ] **Step 4:** `cargo test links` → PASS.
- [ ] **Step 5:** Leave uncommitted.

### Task 3: Shell — window, offline page, tray, single instance, deep links, window state, autostart

**Files:**
- Modify: `src-tauri/Cargo.toml` (tauri features `tray-icon`; plugins listed in Tech Stack; `reqwest = { version = "0.12", default-features = false, features = ["rustls-tls"] }`; `tokio` time if needed)
- Modify: `src-tauri/src/lib.rs`; Create: `src-tauri/src/shell.rs` (window + tray + offline), `src-tauri/src/commands.rs`
- Modify: `src-tauri/build.rs` (app manifest listing the commands)
- Modify: `src-tauri/tauri.conf.json`; Replace: `src-tauri/capabilities/default.json` → `src-tauri/capabilities/sakura-site.json`
- Create: `src-tauri/offline/index.html`

**Interfaces:**
- Consumes: Task 2 `parse_auth_link`, `is_allowed_external`, `PROD_URL`, `DEV_URL`.
- Produces (commands, invoked from the site): `take_pending_auth() -> Option<AuthLink>`, `open_external(url: String) -> Result<(), String>`, `get_autostart() -> bool`, `set_autostart(enabled: bool) -> Result<(), String>`, `app_version() -> String`, `retry_connection()` (from the offline page). Event emitted to the webview: `auth-callback` with `AuthLink` payload.

- [ ] **Step 1: Config.** `tauri.conf.json`: `frontendDist: "../src-tauri/offline"`, remove `beforeBuildCommand`, keep `devUrl`/`beforeDevCommand`; `app.windows: []` (window created in Rust); bundle targets `["nsis","msi","appimage","deb","rpm"]`; `plugins.deep-link.desktop.schemes: ["sakura"]`; `bundle.createUpdaterArtifacts: true`; `plugins.updater` added in Task 4. Capability `sakura-site.json`: `windows: ["main"]`, `remote.urls: ["https://sakura.thefoxy.me/*", "http://localhost:3000/*"]`, permissions `core:event:default` + the app-command permissions generated by `build.rs` (`allow-take-pending-auth`, …) + `updater`/`process:allow-restart` (Task 4). A second capability `offline.json` for local content allowing only `allow-retry-connection`.
- [ ] **Step 2: Window.** In `setup`: probe the target URL with reqwest (HEAD, 5 s timeout, dev → `DEV_URL`); build `WebviewWindowBuilder::new(app, "main", url)` with external URL on success, `WebviewUrl::App("index.html")` otherwise; 1280×800, min 960×600, title « SAKURA ». `retry_connection` re-probes and navigates the window. Offline page: dark page, logo, « Pas de connexion », button calling `window.__TAURI_INTERNALS__.invoke('retry_connection')`.
- [ ] **Step 3: Single instance + deep link.** Register `single-instance` **first** with the `deep-link` feature; its callback shows + unminimizes + focuses `main`. Register `deep-link`; on Linux/Windows dev and AppImage call `register_all()` (ignore errors). `on_open_url`: for each URL, `parse_auth_link` → store in `Mutex<Option<AuthLink>>` state and emit `auth-callback`; show/focus window. Also handle links in `get_current()` at startup (cold start).
- [ ] **Step 4: Tray + close to tray.** `TrayIconBuilder` with default icon, menu: « Ouvrir SAKURA », « Lancer au démarrage » (CheckMenuItem synced with autostart), « Quitter » (`app.exit(0)`). Left click toggles window visibility. `on_window_event` `CloseRequested` → `prevent_close()` + `hide()`; the first time (flag file in app data dir), send a notification « SAKURA reste dans la barre des tâches ».
- [ ] **Step 5: Plugins.** `window-state` (restore on create), `autostart` (`MacosLauncher::LaunchAgent`, no args), `notification`, `process`.
- [ ] **Step 6: Verify.** `cd src-tauri && cargo build` → OK, `cargo test` → PASS. Run `npm run tauri dev` with the dev server up: window shows the site; closing hides to tray; tray menu works; `xdg-open 'sakura://auth/callback?code=test'` focuses the window and `take_pending_auth` returns it (check via devtools console `__TAURI_INTERNALS__.invoke('take_pending_auth')`); stopping the dev server and restarting the app shows the offline page.
- [ ] **Step 7:** Leave uncommitted.

### Task 4: Updater

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`; Create: `src-tauri/src/update.rs`
- Modify: `src-tauri/tauri.conf.json` (`plugins.updater.endpoints`, `pubkey`), capability permissions.

**Interfaces:**
- Produces: commands `check_update() -> Option<UpdateInfo>` (`{ version: String, notes: Option<String>, installable: bool }`; `installable` false for deb/rpm installs, i.e. Linux when `APPIMAGE` env var is unset), `install_update() -> Result<(), String>` (download + install + `app.restart()`); event `update-available` with `UpdateInfo`; background loop: check 20 s after start then every 6 h.

- [ ] **Step 1: User action — signing key.** Ask the user to run `! npx tauri signer generate -w ~/.tauri/sakura.key` and paste the **public** key; put it in `plugins.updater.pubkey`. Remind them to add `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`) to GitHub secrets. Never read or print the private key.
- [ ] **Step 2: Implement** `update.rs` with `tauri_plugin_updater::UpdaterExt`; errors (no network, 404 before the first release) are logged and return `None`.
- [ ] **Step 3: Verify.** `cargo build` OK; in `tauri dev`, `invoke('check_update')` returns `null` without crashing (no release yet).
- [ ] **Step 4:** Leave uncommitted.

### Task 5: Site bridge — sign-in, update toast, Settings › Application

**Files:**
- Create: `src/lib/desktop.ts`, `src/components/desktop/desktop-bridge.tsx`, `src/components/settings/app-group.tsx`
- Modify: `src/core/auth.ts` (`signIn`, and link-identity in `src/components/settings/account-group.tsx`), `src/components/providers.tsx` (mount `<DesktopBridge/>`), `src/app/settings/page.tsx`, `src/app/auth/callback/page.tsx` (extract the "after session" routing into a shared helper)
- Create: `src/core/after-sign-in.ts`

**Interfaces:**
- Consumes: Task 1 route `/auth/app`; Task 3/4 commands and events.
- Produces: `isDesktop(): boolean` (`isTauri()` from `@tauri-apps/api/core`, false on server); `desktop.openExternal(url)`, `desktop.takePendingAuth()`, `desktop.onAuthCallback(cb) => unlisten`, `desktop.getAutostart()`, `desktop.setAutostart(b)`, `desktop.version()`, `desktop.checkUpdate()`, `desktop.installUpdate()`, `desktop.onUpdateAvailable(cb)` — every function is a no-op / resolves `null` when not desktop. `routeAfterSignIn(router, next): Promise<void>` (profile → onboarding or `next`), used by `/auth/callback` and the bridge.

- [ ] **Step 1: Sign-in.** When `isDesktop()`: `signInWithOAuth({ provider, options: { redirectTo: '<origin>/auth/app?next=…', skipBrowserRedirect: true, scopes } })` then `desktop.openExternal(data.url)`; same for `linkIdentity`. Toast « Continuez dans votre navigateur ».
- [ ] **Step 2: Bridge.** `<DesktopBridge/>` (renders nothing on the web): on mount, `takePendingAuth()` then subscribe to `auth-callback`. For a link with `code`: `supabase.auth.exchangeCodeForSession(code)` → `refreshProfile()` → `routeAfterSignIn(router, next)`; with `error`: toast « Connexion impossible : … ». Subscribe to `update-available`: toast with action « Redémarrer » (installable) or « Télécharger » (opens the Release page via `openExternal`). Extend `toast()` with an optional `{ action: { label, onClick } }` if it has none.
- [ ] **Step 3: Settings › Application** (only when `isDesktop()`): Row « Version » (`desktop.version()`), Toggle « Lancer au démarrage », ActionButton « Rechercher une mise à jour » (toast « SAKURA est à jour » when none).
- [ ] **Step 4: Verify.** `npm test`, `npx tsc --noEmit`, lint (no new errors), `npm run build`. In a normal browser: sign-in still uses the redirect flow, no console errors, no Application group. In `tauri dev`: « Continuer avec Discord » opens the system browser; after consent the app comes to front and is signed in (needs `http://localhost:3000/auth/app` in Supabase Redirect URLs for dev — user action).
- [ ] **Step 5:** Leave uncommitted.

### Task 6: Release workflow + docs

**Files:**
- Create: `.github/workflows/desktop-release.yml`
- Modify: `README.md` (section « Application desktop »), `src-tauri/Cargo.toml` / `tauri.conf.json` version `0.1.0`

- [ ] **Step 1:** Workflow on `push: tags: ['app-v*']`: matrix `windows-latest`, `ubuntu-22.04` (apt: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf rpm`), Node 22 + `npm ci`, Rust stable, `tauri-apps/tauri-action@v0` with `tagName: ${{ github.ref_name }}`, `releaseName: 'SAKURA ${{ github.ref_name }}'`, `releaseDraft: true`, `includeUpdaterJson: true`, env `GITHUB_TOKEN`, `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Permissions `contents: write`.
- [ ] **Step 2:** README: run `npm run tauri dev`, publish with `git tag app-v0.1.0 && git push --tags`, required secrets, Supabase redirect URLs (`/auth/app` prod + dev).
- [ ] **Step 3: Verify.** `npx yaml-lint`-equivalent: `node -e "require('yaml')"` not available → validate with `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/desktop-release.yml'))"`; `cd src-tauri && cargo build --release` succeeds locally (Linux bundle via `npm run tauri build -- --bundles appimage` optional).
- [ ] **Step 4:** Leave uncommitted.
