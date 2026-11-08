package {{package}}

// Added by scripts/mobile/android-media.py. The Android WebView has no media notification and no
// picture-in-picture: the site (src/lib/native-media.ts) drives them through `window.SakuraAndroid`.

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Rational
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import org.json.JSONObject
import java.net.URL
import kotlin.concurrent.thread

class SakuraMedia(private val activity: AppCompatActivity, private val webView: WebView) {
    companion object {
        private const val CHANNEL = "sakura-playback"
        private const val NOTIFICATION_ID = 0x5A4B
        private const val ACTION = "app.sakura.MEDIA_ACTION"
        private const val SEEK_STEP_MS = 10_000L
        /** Pages allowed to drive the notification (not the video hosts' iframes). */
        private val HOSTS = setOf("sakura.thefoxy.me", "localhost", "10.0.2.2")
    }

    /** Player open on the site: leaving the app then goes to picture-in-picture. */
    private var watching = false
    private var playing = false
    private var title = ""
    private var artist = ""
    private var artworkUrl: String? = null
    private var artwork: Bitmap? = null
    private var positionMs = 0L
    private var durationMs = 0L
    private var shown = false

    private val session = MediaSessionCompat(activity, "SAKURA").apply {
        setCallback(object : MediaSessionCompat.Callback() {
            override fun onPlay() = send("play")
            override fun onPause() = send("pause")
            override fun onRewind() = send("seekbackward")
            override fun onFastForward() = send("seekforward")
            override fun onSeekTo(pos: Long) = send("seekto", pos / 1000.0)
            override fun onCustomAction(action: String, extras: android.os.Bundle?) = send(action)
        })
    }

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            intent.getStringExtra("action")?.let { send(it) }
        }
    }

    init {
        webView.addJavascriptInterface(this, "SakuraAndroid")
        ContextCompat.registerReceiver(activity, receiver, IntentFilter(ACTION), ContextCompat.RECEIVER_NOT_EXPORTED)
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL, "Lecture en cours", NotificationManager.IMPORTANCE_LOW)
            activity.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    // ───────── Called by the page (binder thread → UI thread) ─────────

    @JavascriptInterface
    fun setWatching(on: Boolean) = onSite {
        watching = on
        updatePipParams()
        if (!on) hide()
    }

    @JavascriptInterface
    fun update(json: String) = onSite {
        val o = JSONObject(json)
        title = o.optString("title")
        artist = o.optString("artist")
        playing = o.optBoolean("playing")
        positionMs = (o.optDouble("position", 0.0) * 1000).toLong()
        durationMs = (o.optDouble("duration", 0.0) * 1000).toLong()
        val art = o.optString("artwork").takeIf { it.startsWith("https://") }
        if (art != artworkUrl) {
            artworkUrl = art
            artwork = null
            if (art != null) loadArtwork(art)
        }
        show()
    }

    @JavascriptInterface
    fun clear() = onSite { hide() }

    private fun onSite(block: () -> Unit) {
        activity.runOnUiThread {
            val host = webView.url?.let { Uri.parse(it).host }
            if (host in HOSTS) block()
        }
    }

    // ───────── Notification + media session ─────────

    private fun show() {
        session.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
                .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork)
                .build()
        )
        session.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or PlaybackStateCompat.ACTION_PLAY_PAUSE or
                        PlaybackStateCompat.ACTION_SEEK_TO or PlaybackStateCompat.ACTION_REWIND or PlaybackStateCompat.ACTION_FAST_FORWARD
                )
                .setState(if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED, positionMs, if (playing) 1f else 0f)
                // Android 13+ builds its media controls from the session: play/pause comes from the
                // actions above, the side buttons from these custom actions.
                .addCustomAction(PlaybackStateCompat.CustomAction.Builder("seekbackward", "Reculer de 10 s", android.R.drawable.ic_media_rew).build())
                .addCustomAction(PlaybackStateCompat.CustomAction.Builder("seekforward", "Avancer de 10 s", android.R.drawable.ic_media_ff).build())
                .build()
        )
        session.isActive = true

        val open = PendingIntent.getActivity(
            activity, 0,
            Intent(activity, activity.javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notification = NotificationCompat.Builder(activity, CHANNEL)
            // A system glyph: the adaptive launcher icon is not a valid small icon on some Android 8 builds.
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(artist)
            .setLargeIcon(artwork)
            .setContentIntent(open)
            .setOngoing(playing)
            .setSilent(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_rew, "Reculer de 10 s", button("seekbackward", 1))
            .addAction(
                if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                if (playing) "Pause" else "Lecture",
                button(if (playing) "pause" else "play", 2)
            )
            .addAction(android.R.drawable.ic_media_ff, "Avancer de 10 s", button("seekforward", 3))
            .setStyle(androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(session.sessionToken).setShowActionsInCompactView(0, 1, 2))
            .build()
        try {
            // Android 13+: only when notifications are allowed (asked by the release reminders).
            if (NotificationManagerCompat.from(activity).areNotificationsEnabled()) {
                NotificationManagerCompat.from(activity).notify(NOTIFICATION_ID, notification)
                shown = true
            }
        } catch (_: SecurityException) {
        }
    }

    private fun hide() {
        if (shown) NotificationManagerCompat.from(activity).cancel(NOTIFICATION_ID)
        shown = false
        session.isActive = false
    }

    private fun button(action: String, code: Int): PendingIntent = PendingIntent.getBroadcast(
        activity, code,
        Intent(ACTION).setPackage(activity.packageName).putExtra("action", action),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    private fun loadArtwork(url: String) = thread(name = "sakura-artwork") {
        val bitmap = try {
            URL(url).openStream().use { BitmapFactory.decodeStream(it) }
        } catch (_: Exception) {
            null
        } ?: return@thread
        val side = 512
        val scaled = if (bitmap.width > side || bitmap.height > side) {
            val ratio = minOf(side.toFloat() / bitmap.width, side.toFloat() / bitmap.height)
            Bitmap.createScaledBitmap(bitmap, (bitmap.width * ratio).toInt(), (bitmap.height * ratio).toInt(), true)
        } else bitmap
        activity.runOnUiThread {
            if (artworkUrl == url) {
                artwork = scaled
                if (shown) show()
            }
        }
    }

    /** Notification button / headset / lock screen → the page's player. */
    private fun send(action: String, time: Double? = null) {
        val detail = JSONObject().put("action", action).apply { if (time != null) put("time", time) }
        webView.post {
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('sakura-media',{detail:$detail}))", null)
        }
    }

    // ───────── Picture-in-picture ─────────

    private val pipSupported: Boolean
        get() = Build.VERSION.SDK_INT >= 26 && activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)

    private fun pipParams(): PictureInPictureParams? {
        if (Build.VERSION.SDK_INT < 26) return null
        val builder = PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9))
        // Android 12+: the system enters picture-in-picture itself on « home » (smooth animation).
        if (Build.VERSION.SDK_INT >= 31) builder.setAutoEnterEnabled(watching)
        return builder.build()
    }

    private fun updatePipParams() {
        if (Build.VERSION.SDK_INT < 26 || !pipSupported) return
        try {
            pipParams()?.let { activity.setPictureInPictureParams(it) }
        } catch (_: IllegalStateException) {
        }
    }

    /** MainActivity.onUserLeaveHint: Android 8–11 need an explicit request. */
    fun enterPipIfWatching() {
        if (Build.VERSION.SDK_INT < 26 || Build.VERSION.SDK_INT >= 31 || !watching || !pipSupported) return
        try {
            pipParams()?.let { activity.enterPictureInPictureMode(it) }
        } catch (_: IllegalStateException) {
        }
    }

    /**
     * WryActivity.onPause() calls webView.onPause(), which freezes the video and the page — and an
     * activity in picture-in-picture is a paused activity. Undo it while in picture-in-picture.
     * Called from MainActivity.onPause() and on entering picture-in-picture (either may come first).
     */
    /** Play state when the activity started pausing (before the WebView froze the video). */
    private var playingWhenLeaving = false

    /** MainActivity.onPause(), before WryActivity pauses the WebView. */
    fun rememberPlaying() {
        playingWhenLeaving = playing
    }

    fun keepRunningInPip() {
        if (Build.VERSION.SDK_INT >= 24 && activity.isInPictureInPictureMode) {
            webView.onResume()
            if (playingWhenLeaving) send("play")
        }
    }

    /** The page shows only the video while in picture-in-picture; closing the window pauses it. */
    fun onPipChanged(inPip: Boolean) {
        if (inPip) {
            webView.onResume()
            // Leaving the app may have paused it (WryActivity.onPause) a moment before.
            if (playingWhenLeaving) send("play")
        }
        webView.evaluateJavascript("document.documentElement.classList.toggle('app-pip', $inPip)", null)
        if (!inPip) {
            webView.postDelayed({
                // Closed with ✕ (not expanded back to full screen): the activity is no longer started.
                if (!activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) send("pause")
            }, 300)
        }
    }

    fun release() {
        hide()
        session.release()
        try {
            activity.unregisterReceiver(receiver)
        } catch (_: IllegalArgumentException) {
        }
    }
}
