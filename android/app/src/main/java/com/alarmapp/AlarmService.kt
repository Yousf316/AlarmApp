package com.alarmapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

class AlarmService : Service() {
    private var mediaPlayer: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private val autoStop = Runnable { stopSelf() }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val label = intent?.getStringExtra(AlarmReceiver.EXTRA_LABEL) ?: "المنبه يرن!"

        // Must be the first thing we do: the system kills the app if
        // startForeground() isn't called within a few seconds.
        val notification = buildNotification(label)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        acquireWakeLock()
        startSound()

        // Don't ring forever if the user never responds.
        handler.removeCallbacks(autoStop)
        handler.postDelayed(autoStop, AUTO_STOP_MS)

        return START_NOT_STICKY
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AlarmApp:AlarmWakeLock").apply {
            acquire(AUTO_STOP_MS + 60_000L)
        }
    }

    private fun alarmUri(): Uri? =
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

    private fun startSound() {
        if (mediaPlayer?.isPlaying == true) return // another alarm already ringing
        val uri = alarmUri() ?: return
        try {
            mediaPlayer = MediaPlayer().apply {
                setDataSource(this@AlarmService, uri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play alarm sound", e)
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(autoStop)
        mediaPlayer?.run {
            try {
                if (isPlaying) stop()
            } catch (_: IllegalStateException) {
            }
            release()
        }
        mediaPlayer = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(label: String): Notification {
        val notificationManager = getSystemService(NotificationManager::class.java)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "المنبهات",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "تنبيهات أوقات الصلاة"
                setSound(null, null) // the sound is played by MediaPlayer
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }

        val fullScreenIntent = Intent(this, AlarmActivity::class.java).apply {
            putExtra(AlarmReceiver.EXTRA_LABEL, label)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopPendingIntent = PendingIntent.getBroadcast(
            this, 0, Intent(this, StopAlarmReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(label)
            .setContentText("اضغط لإيقاف المنبه")
            .setSmallIcon(R.drawable.ic_alarm)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(android.R.drawable.ic_delete, "إيقاف", stopPendingIntent)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "AlarmService"
        // New channel id: channel settings are immutable once created, and the
        // old "alarm_channel" played a default sound on top of MediaPlayer.
        private const val CHANNEL_ID = "alarm_channel_v2"
        private const val NOTIFICATION_ID = 1
        private const val AUTO_STOP_MS = 5 * 60 * 1000L
    }
}
