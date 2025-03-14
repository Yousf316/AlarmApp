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
       val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)

            // إذا كان الوقت المحدد في الماضي، أضف يومًا
            if (timeInMillis <= System.currentTimeMillis()) {
                add(Calendar.DAY_OF_YEAR, 1) // التعديل هنا
            }
        }

        val timeInMillis = calendar.timeInMillis
        val requestCode = alarmid
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
