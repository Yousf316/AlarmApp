package com.alarmapp

import android.app.Activity
import android.content.Intent
import android.media.MediaPlayer
import android.os.Bundle
import android.widget.Button

class AlarmActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_alarm)

        // زر إيقاف التنبيه
        val stopAlarmButton = findViewById<Button>(R.id.stopAlarmButton)
        stopAlarmButton.setOnClickListener {
            stopAlarmService() // إيقاف الخدمة
            finish() // إغلاق الشاشة
        }
    }

    private fun stopAlarmService() {
        val serviceIntent = Intent(this, AlarmService::class.java)
        stopService(serviceIntent) // يوقف الخدمة وبالتالي يوقف الصوت
    }
}
