package com.alarmapp

import android.app.*
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.IBinder
import android.os.PowerManager
import android.os.Build

class AlarmService : Service() {
    private var mediaPlayer: MediaPlayer? = null
    private lateinit var wakeLock: PowerManager.WakeLock

    override fun onCreate() {
        super.onCreate()

        // Prevent the device from sleeping during the service
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "AlarmApp:AlarmWakeLock"
        )
        wakeLock.acquire(10 * 60 * 1000L) // 10 minutes

        // Play alarm sound
        val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        mediaPlayer = MediaPlayer().apply {
            setDataSource(this@AlarmService, alarmUri)
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            isLooping = false // Loop the sound until stopped
            prepare()
            start()
        }

        // Create notification for the Foreground Service
        startForeground(1, createNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        mediaPlayer?.apply {
            stop()
            release()
        }
        wakeLock.release()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotification(): Notification {
        val channelId = "alarm_channel"
        val channelName = "Alarm Notification"
        val notificationManager = getSystemService(NotificationManager::class.java)

        // Create notification channel for newer Android versions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "This channel is used for alarm notifications"
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Set up "Stop" button in the notification
        val stopIntent = Intent(this, StopAlarmReceiver::class.java)
        val stopPendingIntent = PendingIntent.getBroadcast(
            this, 0, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return Notification.Builder(this, channelId)
            .setContentTitle("المنبه يرن")
            .setContentText("اضغط لايقاف المنبه")
            .setSmallIcon(R.drawable.ic_alarm)
            .addAction(android.R.drawable.ic_delete, "التوقف", stopPendingIntent)
            .setOngoing(true) // Prevent the notification from being dismissed
            .build()
    }
}

