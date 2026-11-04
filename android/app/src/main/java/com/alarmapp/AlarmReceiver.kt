package com.alarmapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val id = intent?.getIntExtra(EXTRA_ALARM_ID, -1) ?: -1
        val label = intent?.getStringExtra(EXTRA_LABEL) ?: "المنبه يرن!"

        if (id != -1) {
            AlarmScheduler(context).markFired(id)
        }

        // Starting an activity from the background is blocked on Android 10+.
        // The service posts a full-screen-intent notification that opens
        // AlarmActivity instead (over the lock screen).
        val serviceIntent = Intent(context, AlarmService::class.java).apply {
            putExtra(EXTRA_LABEL, label)
        }
        ContextCompat.startForegroundService(context, serviceIntent)
    }

    companion object {
        const val EXTRA_ALARM_ID = "alarmId"
        const val EXTRA_LABEL = "alarmLabel"
    }
}
