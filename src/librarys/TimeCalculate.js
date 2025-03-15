class TimeCalculate {
    constructor() {
        // Initialize any properties if needed
    }

    // Method to add minutes to a given time
    addMinutes(time, minutes) {
        const date = new Date(time);
        date.setMinutes(date.getMinutes() + minutes);
        return date;
    }

    // Method to subtract minutes from a given time
    subtractMinutes(time, minutes) {
        const date = new Date(time);
        date.setMinutes(date.getMinutes() - minutes);
        return date;
    }

    // Method to format time as HH:MM
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

     convertTo12HourFormat = (time) => {
        if (!time) return 'Invalid Time';
      
        let [hours, minutes] = time.split(':').map(Number);
        let period = hours >= 12 ? 'PM' : 'AM';
      
        hours = hours % 12 || 12;
      
        return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
      };



        calculateAlarmTime = (prayerTime, hoursBefore, minutesBefore) => {
          // التأكد من أن prayerTime بصيغة "HH:MM" وتحويلها إلى كائن
          if (typeof prayerTime === "string") {
              const [hour, minute] = prayerTime.split(":").map((part) => parseInt(part, 10));
              prayerTime = { hour, minute };
          }
      
          if (!prayerTime || isNaN(prayerTime.hour) || isNaN(prayerTime.minute)) {
              Alert.alert("خطأ", "وقت الصلاة غير صحيح.");
              console.log("❌ خطأ: وقت الصلاة غير صالح:", prayerTime);
              return null;
          }
      
          let { hour, minute } = prayerTime;
          let reduceHours = parseInt(hoursBefore, 10);
          let reduceMinutes = parseInt(minutesBefore, 10);
      
          if (isNaN(reduceHours) || isNaN(reduceMinutes)) {
              Alert.alert("خطأ", "يرجى إدخال أرقام صحيحة.");
              console.log("❌ خطأ: القيم المدخلة غير صحيحة", reduceHours, reduceMinutes);
              return null;
          }
      
          console.log("✅ وقت الصلاة:", hour, minute);
      
          let totalMinutes = hour * 60 + minute; // تحويل وقت الصلاة إلى دقائق
          let alarmMinutes = totalMinutes - (reduceHours * 60 + reduceMinutes); // طرح الوقت المسبق
      
          // إذا كان الوقت الناتج قبل منتصف الليل، أضف 24 ساعة (1440 دقيقة)
          if (alarmMinutes < 0) {
              alarmMinutes += 1440; // 24 ساعة × 60 دقيقة
          }
      
          let finalHour = Math.floor(alarmMinutes / 60);
          let finalMinute = alarmMinutes % 60;
      
      
          return { finalHour, finalMinute };
      };
}

module.exports = TimeCalculate;