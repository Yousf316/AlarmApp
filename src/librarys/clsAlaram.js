import { addAlarm, deleteAlarmByUserTime, getAlarmsByUserTimeId } from "../../database/alarmService";
import { deleteUserTime } from "../../database/userTimeService";
import TimeCalculate from "./TimeCalculate";
import { NativeModules } from "react-native";

class clsAlarm {
    // Static method example
    static async setAlarm(usertimeid, prayertime, hour, minute, label) {
        const { AlarmModule } = NativeModules;
        const timeCalculate = new TimeCalculate();
      
        try {
          // Calculate the alarm time
          const alarmTime = timeCalculate.calculateAlarmTime(prayertime, hour, minute);
      console.log('Alarm Time:', alarmTime);
          if (!alarmTime) {
            console.log("❌ فشل في حساب وقت المنبه.");
            throw new Error("Failed to calculate alarm time.");
          }
      
          // Get today's date in YYYY-MM-DD format
          const today = new Date();
          const alarmDate = today.toISOString().split("T")[0];
      
          // Save the alarm and get its ID
          const alarmId = await addAlarm(alarmDate, alarmTime.finalHour, alarmTime.finalMinute, usertimeid)
            .then((id) => id)
            .catch((error) => {
              throw error;
            });
      
          console.log("✅ حفظ المنبه بنجاح:", alarmId);
      
          // Set the alarm using the native module
           AlarmModule.setAlarm(alarmId, alarmTime.finalHour, alarmTime.finalMinute, label);
      
          console.log(`⏰ Alarm set for ${usertimeid} at ${alarmTime.finalHour}:${alarmTime.finalMinute} (${label})`);
        } catch (error) {
          console.error("❌ Error setting alarm:", error);
          throw error; // Re-throw the error for the caller to handle
        }
      }

    static async cancelAlarm(usertimeid) {
        const { AlarmModule } = NativeModules;

        try {
            const alarms = await getAlarmsByUserTimeId(usertimeid); // انتظر جلب الإنذارات
            console.log('Alarms:', alarms);
            if (alarms.length === 0) {
                console.log('No alarms found for this user_time_id.');
                return; // Use return instead of throw to ensure finally is reached
            }
    
            alarms.forEach(alarm => {
                AlarmModule.cancelAlarm(alarm.id); // إلغاء كل إنذار مرتبط بـ usertimeid
            });
    
            await deleteAlarmByUserTime(usertimeid); // حذف الإنذارات من قاعدة البيانات
            
            console.log('Alarm canceled');
        } catch (error) {
            console.error('Error canceling alarm:', error);
        } finally {
            (async () => {
                await deleteUserTime(usertimeid);
                console.log('User Time canceled');
            })();
        }
    }
    
}



export default clsAlarm;