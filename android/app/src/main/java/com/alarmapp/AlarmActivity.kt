package com.alarmapp

import android.app.Activity
import android.content.Intent
import android.media.MediaPlayer
import android.os.Bundle
import android.widget.Button
import android.widget.TextView // Add this import

class AlarmActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_alarm)
        val label = intent.getStringExtra("alarmLabel") ?: "المنبه يرن!"
val textView = findViewById<TextView>(R.id.alarmLabelTextView)

        // Set the label text
        textView.text = label
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
