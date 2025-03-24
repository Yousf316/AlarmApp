package com.alarmapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

class AlarmScheduler(private val context: Context) {
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    fun setAlarm(timeInMillis: Long, requestCode: Int,label:String) {
        val intent = Intent(context, AlarmReceiver::class.java)
        intent.putExtra("alarmLabel", label)
        val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent,  PendingIntent.FLAG_IMMUTABLE)

        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timeInMillis, pendingIntent)
    }

    fun cancelAlarm(requestCode: Int) {
        val intent = Intent(context, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent,  PendingIntent.FLAG_IMMUTABLE)
        alarmManager.cancel(pendingIntent)
    }
}
