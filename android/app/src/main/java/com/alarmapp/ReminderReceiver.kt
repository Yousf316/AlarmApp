package com.alarmapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

/** Posts a plain notification (no ringing) scheduled via [AlarmScheduler.setReminder]. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val id = intent?.getIntExtra(EXTRA_ID, -1) ?: -1
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: return
        val body = intent?.getStringExtra(EXTRA_BODY) ?: ""

        if (id != -1) {
            AlarmScheduler(context).markReminderFired(id)
        }

        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "تجديد المنبهات", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }

        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.ic_alarm)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        // Silently ignored by the system when POST_NOTIFICATIONS was denied.
        manager.notify(NOTIFICATION_BASE_ID + id, notification)
    }

    companion object {
        const val EXTRA_ID = "reminderId"
        const val EXTRA_TITLE = "reminderTitle"
        const val EXTRA_BODY = "reminderBody"
        // Same id the Notifee-era channel used, so users keep their channel settings.
        private const val CHANNEL_ID = "renew"
        private const val NOTIFICATION_BASE_ID = 5000
    }
}
