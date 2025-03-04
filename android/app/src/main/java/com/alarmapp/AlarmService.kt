package com.alarmapp

import android.app.*
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.IBinder
import android.os.PowerManager

class AlarmService : Service() {
    private var mediaPlayer: MediaPlayer? = null
    private lateinit var wakeLock: PowerManager.WakeLock

    override fun onCreate() {
        super.onCreate()

        // 🔹 منع الجهاز من النوم أثناء تشغيل الخدمة
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "AlarmApp:AlarmWakeLock"
        )
        wakeLock.acquire(10 * 60 * 1000L) // 10 دقائق

        // 🔹 تشغيل صوت المنبه
        val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        mediaPlayer = MediaPlayer().apply {
            setDataSource(this@AlarmService, alarmUri)
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            isLooping = true // تكرار الصوت حتى يتم إيقافه
            prepare()
            start()
        }

        // 🔹 إنشاء إشعار للـ Foreground Service
        startForeground(1, createNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        mediaPlayer?.stop()
        mediaPlayer?.release()
        wakeLock.release()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotification(): Notification {
        val channelId = "alarm_channel"
        val channelName = "Alarm Notification"
        val notificationManager = getSystemService(NotificationManager::class.java)

        // 🔹 إنشاء قناة الإشعارات للإصدارات الحديثة
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        // 🔹 إعداد زر "إيقاف" في الإشعار
        val stopIntent = Intent(this, StopAlarmReceiver::class.java)
        val stopPendingIntent = PendingIntent.getBroadcast(
            this, 0, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return Notification.Builder(this, channelId)
            .setContentTitle("المنبه يعمل")
            .setContentText("اضغط لإيقاف المنبه")
            .setSmallIcon(R.drawable.ic_alarm)
            .addAction(android.R.drawable.ic_delete, "إيقاف", stopPendingIntent)
            .setOngoing(true) // يمنع سحب الإشعار لإيقاف الخدمة
            .build()
    }
}
