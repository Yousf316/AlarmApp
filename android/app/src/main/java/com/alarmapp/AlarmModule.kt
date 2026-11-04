package com.alarmapp

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AlarmModule"

    private val scheduler by lazy { AlarmScheduler(reactApplicationContext) }

    /**
     * @param alarmId   DB row id – also used as the PendingIntent request code
     * @param timestamp exact trigger instant in ms since epoch (computed in JS)
     */
    @ReactMethod
    fun setAlarm(alarmId: Int, timestamp: Double, label: String, promise: Promise) {
        try {
            val triggerAt = timestamp.toLong()
            if (triggerAt <= System.currentTimeMillis()) {
                promise.reject("ALARM_IN_PAST", "Alarm time is in the past")
                return
            }
            scheduler.setAlarm(alarmId, triggerAt, label)
            Log.d(TAG, "⏰ Alarm $alarmId set for $triggerAt ($label)")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_ALARM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAlarm(alarmId: Int, promise: Promise) {
        try {
            scheduler.cancelAlarm(alarmId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ALARM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAll(promise: Promise) {
        try {
            scheduler.cancelAll()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ALL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        promise.resolve(scheduler.canScheduleExact())
    }

    companion object {
        private const val TAG = "AlarmModule"
    }
}
