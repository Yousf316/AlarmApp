package com.alarmapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
      

        // تشغيل Foreground Service لتشغيل صوت المنبه
        val serviceIntent = Intent(context, AlarmService::class.java)
        context.startService(serviceIntent)

       val alarmIntent = Intent(context, AlarmActivity::class.java)
        alarmIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        context?.startActivity(alarmIntent)

    }
}
