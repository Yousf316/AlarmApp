package com.alarmapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        // Wake up the device
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "AlarmApp:WakeLock"
        )
        wakeLock.acquire(10 * 60 * 1000L) // Hold wake lock for 10 minutes

        // تشغيل Foreground Service لتشغيل صوت المنبه
        val serviceIntent = Intent(context, AlarmService::class.java)
        context.startService(serviceIntent)

       val alarmIntent = Intent(context, AlarmActivity::class.java)
        alarmIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        context?.startActivity(alarmIntent)
    }
}
