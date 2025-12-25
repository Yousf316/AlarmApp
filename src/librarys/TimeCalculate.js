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



      calculateAlarmTime = (date, prayerTime, hoursBefore, minutesBefore) => {
  if (!prayerTime || typeof prayerTime !== "string" || !prayerTime.includes(":")) {
    Alert.alert("خطأ", "وقت الصلاة غير صحيح أو مفقود.");
    console.log("❌ خطأ: وقت الصلاة غير صالح:", prayerTime);
    return null;
  }

  prayerTime = prayerTime.split(" ")[0];
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

  // 🧠 Parse the date correctly (supports DD-MM-YYYY)
  let baseDate;
  if (typeof date === "string" && date.includes("-")) {
    const parts = date.split("-");
    if (parts[0].length === 2) {
      // probably DD-MM-YYYY → fix order
      const [day, month, year] = parts.map(Number);
      baseDate = new Date(year, month - 1, day);
    } else {
      // assume YYYY-MM-DD
      baseDate = new Date(date);
    }
  } else {
    baseDate = new Date();
  }

  if (isNaN(baseDate.getTime())) {
    baseDate = new Date(); // fallback if invalid
  }

  let totalMinutes = hour * 60 + minute;
  let alarmMinutes = totalMinutes - (hoursBefore * 60 + minutesBefore);

  // If alarm time goes to previous day
  if (alarmMinutes < 0) {
    alarmMinutes += 1440; // add 24h
    baseDate.setDate(baseDate.getDate() - 1);
  }

  const finalHour = Math.floor(alarmMinutes / 60);
  const finalMinute = alarmMinutes % 60;
  const finalDate = baseDate.toISOString().split("T")[0];

  return { finalDate, finalHour, finalMinute };
};

    
    static isValidTime(hours, minutes) {
        return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
    }
}

module.exports = TimeCalculate;