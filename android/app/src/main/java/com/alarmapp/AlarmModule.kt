package com.alarmapp

import android.content.Context
import java.util.Calendar
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class AlarmModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "AlarmModule"
    }

    @ReactMethod
    fun setAlarm(alarmid: Int,hour: Int, minute: Int) {
        val scheduler = AlarmScheduler(reactApplicationContext)

        // حساب الوقت بالـ Milliseconds
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.HOUR_OF_DAY, hour)
        calendar.set(Calendar.MINUTE, minute)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)

        val timeInMillis = calendar.timeInMillis
        val requestCode = alarmid // كود فريد لكل منبه

        scheduler.setAlarm(timeInMillis, requestCode)
    }

    @ReactMethod
fun cancelAlarm(id: Int, promise: Promise) {
    try {
                  val scheduler = AlarmScheduler(reactApplicationContext)
      scheduler.cancelAlarm(id)
        promise.resolve(true)
    } catch (e: Exception) {
        promise.reject("CANCEL_ALARM_ERROR", "Failed to cancel alarm", e)
    }
}

}
