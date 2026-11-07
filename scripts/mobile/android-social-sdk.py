#!/usr/bin/env python3
"""Adds the Discord Social SDK to the generated Android project (CI, after `tauri android init`).

Usage: android-social-sdk.py <src-tauri/gen/android> <sdk dir> <discord application id>
The SDK dir holds android/discord_partner_sdk.aar (from the private sakura-sdk repo).
"""
import re
import shutil
import sys
from pathlib import Path

# The SDK declares voice-chat permissions and a foreground service: SAKURA only sets a status.
UNUSED_PERMISSIONS = [
    "android.permission.RECORD_AUDIO",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MICROPHONE",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    "android.permission.MODIFY_AUDIO_SETTINGS",
    "android.permission.BLUETOOTH",
    "android.permission.BLUETOOTH_CONNECT",
]

MARK = "Discord Social SDK"


def fail(msg: str) -> None:
    print(f"::error::{msg}")
    sys.exit(1)


def gradle(app: Path) -> None:
    path = app / "build.gradle.kts"
    text = path.read_text()
    if MARK in text:
        return
    text += f"""
// {MARK} (scripts/mobile/android-social-sdk.py)
dependencies {{
    implementation(files("libs/discord_partner_sdk.aar"))
    // The SDK's sign-in screen (Custom Tabs), version required by SDK 1.10.
    implementation("androidx.browser:browser:1.8.0")
}}
"""
    path.write_text(text)


def manifest(app: Path, app_id: str) -> None:
    path = app / "src/main/AndroidManifest.xml"
    text = path.read_text()
    if MARK in text:
        return
    if "xmlns:tools" not in text:
        text, n = re.subn(r"<manifest\b", '<manifest xmlns:tools="http://schemas.android.com/tools"', text, count=1)
        if n != 1:
            fail("AndroidManifest.xml : balise <manifest> introuvable")
    removals = "".join(f'    <uses-permission android:name="{p}" tools:node="remove" />\n' for p in UNUSED_PERMISSIONS)
    text, n = re.subn(r"(\n\s*<application\b)", f"\n    <!-- {MARK}: no voice chat -->\n{removals.rstrip()}\\1", text, count=1)
    if n != 1:
        fail("AndroidManifest.xml : balise <application> introuvable")
    activity = f"""        <!-- {MARK}: no voice chat service -->
        <service android:name="com.discord.socialsdk.ForegroundService" tools:node="remove" />
        <!-- {MARK}: return from Discord's « Authorize » screen -->
        <activity
            android:name="com.discord.socialsdk.AuthenticationActivity"
            android:exported="true"
            tools:node="merge">
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="discord-{app_id}" />
            </intent-filter>
        </activity>
"""
    text, n = re.subn(r"(\s*</application>)", "\n" + activity.rstrip() + r"\1", text, count=1)
    if n != 1:
        fail("AndroidManifest.xml : </application> introuvable")
    path.write_text(text)


def main_activity(app: Path) -> None:
    found = list((app / "src/main").rglob("MainActivity.kt"))
    if len(found) != 1:
        fail(f"MainActivity.kt introuvable ({len(found)} fichiers)")
    path = found[0]
    text = path.read_text()
    if "DiscordSocialSdkInit" in text:
        return
    # The SDK needs the activity (sign-in screen, Android context) before Rust starts.
    line = "    com.discord.socialsdk.DiscordSocialSdkInit.setEngineActivity(this)\n"
    text, n = re.subn(r"(override fun onCreate\(savedInstanceState: Bundle\?\) \{\n)", r"\1" + line, text, count=1)
    if n != 1:
        text, n = re.subn(
            r"class MainActivity : TauriActivity\(\)\s*(\{\s*\})?\s*$",
            "class MainActivity : TauriActivity() {\n  override fun onCreate(savedInstanceState: android.os.Bundle?) {\n"
            + line
            + "    super.onCreate(savedInstanceState)\n  }\n}\n",
            text,
            count=1,
            flags=re.M,
        )
    if n != 1:
        fail("MainActivity.kt : onCreate introuvable")
    path.write_text(text)


def main() -> None:
    if len(sys.argv) != 4:
        fail(__doc__)
    gen, sdk, app_id = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    app = gen / "app"
    aar = sdk / "android/discord_partner_sdk.aar"
    if not aar.is_file():
        fail(f"{aar} introuvable")
    (app / "libs").mkdir(exist_ok=True)
    shutil.copy(aar, app / "libs/discord_partner_sdk.aar")
    gradle(app)
    manifest(app, app_id)
    main_activity(app)
    print(f"{MARK} ajouté au projet Android")


if __name__ == "__main__":
    main()
