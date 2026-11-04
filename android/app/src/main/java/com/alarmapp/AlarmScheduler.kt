package com.alarmapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Schedules alarms with AlarmManager and persists them in SharedPreferences so
 * they can be restored after a reboot (AlarmManager forgets everything then).
 */
class AlarmScheduler(context: Context) {
    private val context = context.applicationContext
    private val alarmManager = this.context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    private val prefs = this.context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val reminderPrefs = this.context.getSharedPreferences(REMINDER_PREFS_NAME, Context.MODE_PRIVATE)

    fun canScheduleExact(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()

    fun setAlarm(id: Int, triggerAtMillis: Long, label: String) {
        val operation = alarmPendingIntent(id, label)
        try {
            if (canScheduleExact()) {
                // setAlarmClock is the most reliable API: exact, survives Doze and
                // shows the alarm icon in the status bar.
                val showIntent = PendingIntent.getActivity(
                    context,
                    0,
                    Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent), operation)
            } else {
                // Permission revoked by the user: degrade to an inexact alarm instead of crashing.
                Log.w(TAG, "Exact alarm permission missing, using inexact alarm for $id")
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, operation)
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException scheduling $id, falling back to inexact", e)
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, operation)
        }
        prefs.edit().putString(id.toString(), "$triggerAtMillis|$label").apply()
    }

    fun cancelAlarm(id: Int) {
        val operation = alarmPendingIntent(id, null)
        alarmManager.cancel(operation)
        operation.cancel()
        prefs.edit().remove(id.toString()).apply()
    }

    fun cancelAll() {
        prefs.all.keys.mapNotNull { it.toIntOrNull() }.forEach { cancelAlarm(it) }
        prefs.edit().clear().apply()
    }

    /** Called when an alarm fires – it is no longer pending. */
    fun markFired(id: Int) {
        prefs.edit().remove(id.toString()).apply()
    }

    /**
     * A plain (non-ringing) notification, e.g. "open the app to renew the
     * alarms". Inexact on purpose: needs no exact-alarm permission.
     */
    fun setReminder(id: Int, triggerAtMillis: Long, title: String, body: String) {
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAtMillis,
            reminderPendingIntent(id, title, body)
        )
        reminderPrefs.edit().putString(id.toString(), "$triggerAtMillis|$title|$body").apply()
    }

    fun cancelReminder(id: Int) {
        val operation = reminderPendingIntent(id, null, null)
        alarmManager.cancel(operation)
        operation.cancel()
        reminderPrefs.edit().remove(id.toString()).apply()
    }

    fun markReminderFired(id: Int) {
        reminderPrefs.edit().remove(id.toString()).apply()
    }

    /** Re-register every stored future alarm (after boot / time change). */
    fun restoreAll() {
        restoreReminders()
        val now = System.currentTimeMillis()
        for ((key, value) in prefs.all) {
            val id = key.toIntOrNull() ?: continue
            val parts = (value as? String)?.split("|", limit = 2) ?: continue
            val triggerAt = parts[0].toLongOrNull() ?: continue
            val label = parts.getOrElse(1) { "" }
            if (triggerAt > now) {
                setAlarm(id, triggerAt, label)
            } else {
                prefs.edit().remove(key).apply()
            }
        }
    }

    private fun restoreReminders() {
        val now = System.currentTimeMillis()
        for ((key, value) in reminderPrefs.all) {
            val id = key.toIntOrNull() ?: continue
            val parts = (value as? String)?.split("|", limit = 3) ?: continue
            val triggerAt = parts[0].toLongOrNull() ?: continue
            if (triggerAt > now) {
                setReminder(id, triggerAt, parts.getOrElse(1) { "" }, parts.getOrElse(2) { "" })
            } else {
                reminderPrefs.edit().remove(key).apply()
            }
        }
    }

    private fun reminderPendingIntent(id: Int, title: String?, body: String?): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION_REMINDER
            putExtra(ReminderReceiver.EXTRA_ID, id)
            title?.let { putExtra(ReminderReceiver.EXTRA_TITLE, it) }
            body?.let { putExtra(ReminderReceiver.EXTRA_BODY, it) }
        }
        return PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun alarmPendingIntent(id: Int, label: String?): PendingIntent {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_FIRE
            putExtra(AlarmReceiver.EXTRA_ALARM_ID, id)
            label?.let { putExtra(AlarmReceiver.EXTRA_LABEL, it) }
        }
        return PendingIntent.getBroadcast(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        private const val TAG = "AlarmScheduler"
        private const val PREFS_NAME = "scheduled_alarms"
        private const val REMINDER_PREFS_NAME = "scheduled_reminders"
        const val ACTION_FIRE = "com.alarmapp.ALARM_FIRE"
        const val ACTION_REMINDER = "com.alarmapp.REMINDER_FIRE"
    }
}
