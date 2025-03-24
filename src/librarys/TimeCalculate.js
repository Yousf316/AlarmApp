const { Alert } = require("react-native");

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
        time = time.split(' ')[0]; 
        let [hours, minutes] = time.split(':').map(Number);
        let period = hours >= 12 ? 'PM' : 'AM';
      
        hours = hours % 12 || 12;
      
        return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
      };



       calculateAlarmTime = (prayerTime, hoursBefore, minutesBefore) => {
        if (!prayerTime || typeof prayerTime !== "string" || !prayerTime.includes(":")) {
            Alert.alert("خطأ", "وقت الصلاة غير صحيح أو مفقود.");
            console.log("❌ خطأ: وقت الصلاة غير صالح:", prayerTime);
            return null;
        }
    
        prayerTime = prayerTime.split(' ')[0]; 

        // تحويل النص "HH:MM" إلى كائن { hour, minute }
        const [hour, minute] = prayerTime.split(":").map((part) => parseInt(part, 10));
        
        if (isNaN(hour) || isNaN(minute)) {
            Alert.alert("خطأ", "تنسيق وقت الصلاة غير صالح.");
            console.log("❌ خطأ: القيم المستخرجة غير صالحة:", { hour, minute });
            return null;
        }
    
        if (isNaN(hoursBefore) || isNaN(minutesBefore)) {
            Alert.alert("خطأ", "يرجى إدخال أرقام صحيحة للساعات والدقائق.");
            console.log("❌ خطأ: القيم المدخلة غير صحيحة", hoursBefore, minutesBefore);
            return null;
        }
    
        console.log("✅ وقت الصلاة:", hour, minute);
    
        let totalMinutes = hour * 60 + minute; // تحويل وقت الصلاة إلى دقائق
        let alarmMinutes = totalMinutes - (hoursBefore * 60 + minutesBefore); // طرح الوقت المسبق
    
        // التأكد من أن الوقت الناتج ليس سالبًا
        if (alarmMinutes < 0) {//
            alarmMinutes += 1440; // إضافة 24 ساعة (1440 دقيقة) لضبط الوقت
        }
    
        let finalHour = Math.floor(alarmMinutes / 60);
        let finalMinute = alarmMinutes % 60;
    
        return { finalHour, finalMinute };
    };
    
}

module.exports = TimeCalculate;