#!/usr/bin/env python3
"""Media notification + picture-in-picture for the Android app (CI, after `tauri android init`).

Usage: android-media.py <src-tauri/gen/android>
Adds SakuraMedia.kt (scripts/mobile/android/) next to MainActivity, hooks it into MainActivity,
lets the activity go to picture-in-picture and adds androidx.media. Idempotent.
"""
import re
import sys
from pathlib import Path

MARK = "SAKURA media"
HERE = Path(__file__).resolve().parent


def fail(msg: str) -> None:
    print(f"::error::{msg}")
    sys.exit(1)


def gradle(app: Path) -> None:
    path = app / "build.gradle.kts"
    text = path.read_text()
    if MARK in text:
        return
    text += f"""
// {MARK} (scripts/mobile/android-media.py): MediaSessionCompat + MediaStyle notification.
dependencies {{
    implementation("androidx.media:media:1.7.0")
}}
"""
    path.write_text(text)


def manifest(app: Path) -> None:
    path = app / "src/main/AndroidManifest.xml"
    text = path.read_text()
    if "supportsPictureInPicture" in text:
        return
    m = re.search(r"<activity\b[^>]*android:name=\"[^\"]*MainActivity\"[^>]*>", text, re.S)
    if not m:
        fail("AndroidManifest.xml : activité MainActivity introuvable")
    tag = m.group(0)
    new = tag.replace("<activity", '<activity\n            android:supportsPictureInPicture="true"\n            android:resizeableActivity="true"', 1)
    # Picture-in-picture resizes the window: keep the activity (and the playing video) alive.
    needed = ["orientation", "screenSize", "smallestScreenSize", "screenLayout"]
    cm = re.search(r'android:configChanges="([^"]*)"', new)
    if cm:
        have = cm.group(1).split("|")
        merged = "|".join(have + [n for n in needed if n not in have])
        new = new.replace(cm.group(0), f'android:configChanges="{merged}"')
    else:
        new = new.replace("<activity", f'<activity\n            android:configChanges="{"|".join(needed)}"', 1)
    path.write_text(text.replace(tag, new, 1))


def main_activity(app: Path) -> None:
    found = list((app / "src/main").rglob("MainActivity.kt"))
    if len(found) != 1:
        fail(f"MainActivity.kt introuvable ({len(found)} fichiers)")
    path = found[0]
    text = path.read_text()
    pkg = re.search(r"^package\s+([\w.]+)", text, re.M)
    if not pkg:
        fail("MainActivity.kt : package introuvable")
    kt = (HERE / "android/SakuraMedia.kt").read_text().replace("{{package}}", pkg.group(1))
    (path.parent / "SakuraMedia.kt").write_text(kt)
    if MARK in text:
        return
    hooks = f"""
  // {MARK} (scripts/mobile/android-media.py): notification + picture-in-picture.
  private var sakuraMedia: SakuraMedia? = null

  override fun onWebViewCreate(webView: android.webkit.WebView) {{
    super.onWebViewCreate(webView)
    sakuraMedia = SakuraMedia(this, webView)
  }}

  override fun onUserLeaveHint() {{
    super.onUserLeaveHint()
    sakuraMedia?.enterPipIfWatching()
  }}

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: android.content.res.Configuration) {{
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    sakuraMedia?.onPipChanged(isInPictureInPictureMode)
  }}

  override fun onDestroy() {{
    sakuraMedia?.release()
    super.onDestroy()
  }}
"""
    # `class MainActivity : TauriActivity()` without a body: give it one.
    text, n = re.subn(r"class MainActivity : TauriActivity\(\)\s*(\{\s*\})?\s*$", "class MainActivity : TauriActivity() {\n}\n", text, count=1, flags=re.M)
    end = text.rstrip().rfind("}")
    if end < 0 or "class MainActivity" not in text:
        fail("MainActivity.kt : classe MainActivity introuvable")
    text = text[:end].rstrip() + "\n" + hooks + "}\n"
    path.write_text(text)


def main() -> None:
    if len(sys.argv) != 2:
        fail(__doc__)
    app = Path(sys.argv[1]) / "app"
    gradle(app)
    manifest(app)
    main_activity(app)
    print(f"{MARK} ajouté au projet Android")


if __name__ == "__main__":
    main()
