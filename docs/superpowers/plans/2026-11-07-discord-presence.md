# Discord Rich Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Show « Regarde SAKURA — <anime> · Épisode N » on Discord from the desktop app while a video plays.
**Architecture:** The site builds the activity with a pure function and sends it to a Rust command; a Rust thread owns the Discord IPC connection, keeps the desired activity and reconnects.
**Tech Stack:** `discord-rich-presence` 1.1, Tauri 2 command, Next.js page hook.
**Spec:** `docs/superpowers/specs/2026-11-07-discord-presence-design.md`

## Global Constraints
- Client ID `1568341036894523432`. Discord fields 2–128 chars; buttons max 2, label ≤ 32, https URLs only.
- Website unaffected (all calls via `desktop.*`, no-op on the web). No commits.

## Review Focus
- Closing the player / leaving the page / disabling the setting clears the activity.
- Discord not running at app start, then started: activity appears without user action.
- Seeking in the video updates the end time; pausing removes the time bar.

### Task 1: Pure activity builder (site)
Files: `src/lib/presence.ts`, `src/lib/presence.test.ts`.
Produces `buildPresence(input: PresenceInput): PresencePayload` and types (`PresencePayload` = `{ details, state, large_image, large_text, small_image, small_text, start?, end?, button_label, button_url }`, timestamps in epoch seconds).
- [ ] Tests: playing with duration → start = now − time, end = start + duration; paused → no timestamps, state starts with « En pause »; single season omits « Saison »; iframe (no duration) → no timestamps; title truncated to 128 chars, 1-char title padded to 2; button URL = `<origin>/anime?id=<id>`.
- [ ] RED, implement, GREEN (`npm test`).

### Task 2: Rust presence service
Files: `src-tauri/src/presence.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src-tauri/build.rs`, capability.
Produces command `set_presence(activity: Option<PresencePayload>)`; `presence::spawn(app)` thread with mpsc channel, reconnect every 15 s, re-apply desired state after reconnect.
- [ ] Rust tests for `sanitize(payload)` (clamps lengths, drops non-https images/buttons).
- [ ] RED, implement, GREEN (`cargo test`), `cargo build`.

### Task 3: Wiring + setting
Files: `src/lib/desktop.ts` (`setPresence`), `src/components/player/player-overlay.tsx` (`onPlayingChange` prop), `src/app/anime/page.tsx` (hook `useDiscordPresence`), `src/core/store.ts` + `store-migrate.ts` (setting `discordPresence: true`, v8, test), `src/components/settings/app-group.tsx` (toggle).
- [ ] Migration test RED→GREEN; tsc, lint, `npm test`, `npm run build`.
- [ ] Live check: `tauri dev` with Discord open → status shows while playing, pauses, clears on close (user confirms visually).
