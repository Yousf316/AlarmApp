package com.alarmapp

import android.content.Context
import java.util.Calendar
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.text.SimpleDateFormat
import java.text.ParseException
import java.util.Date
import java.util.Locale
import android.util.Log
class AlarmModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "AlarmModule"
    }
@ReactMethod
fun setAlarm(alarmid: Int, date: String, hour: Int, minute: Int, label: String) {
    val scheduler = AlarmScheduler(reactApplicationContext)
    val TAG = "AlarmManager"

    // تحويل التاريخ النصي إلى كائن Calendar
    val calendar = Calendar.getInstance().apply {
        try {
            val dateFormat = SimpleDateFormat("dd-MM-yyyy", Locale.ENGLISH)
            dateFormat.timeZone = TimeZone.getDefault()
            time = dateFormat.parse(date) ?: throw ParseException("Invalid date format", 0) // ضبط التاريخ
        } catch (e: ParseException) {
            Log.e(TAG, "❌ خطأ في تحليل التاريخ: $date", e)
            return
        }

        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }

    val timeInMillis = calendar.timeInMillis

    if (timeInMillis <= System.currentTimeMillis()) {
        Log.w(TAG, "⚠️ الوقت المحدد في الماضي، لن يتم ضبط المنبه.")
        return
    }

    val requestCode = alarmid

    // 🔹 طباعة بيانات المنبه للتحقق
    Log.d(TAG, "⏰ ضبط المنبه في: ${calendar.get(Calendar.YEAR)}-${calendar.get(Calendar.MONTH) + 1}-${calendar.get(Calendar.DAY_OF_MONTH)} ${calendar.get(Calendar.HOUR_OF_DAY)}:${calendar.get(Calendar.MINUTE)}")

    scheduler.setAlarm(timeInMillis, requestCode, label)
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
