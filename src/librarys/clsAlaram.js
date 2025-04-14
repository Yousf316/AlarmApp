import { addAlarm, deleteAlarmByUserTime, getAlarmsByUserTimeId } from "../../database/alarmService";
import { deleteUserTime } from "../../database/userTimeService";
import TimeCalculate from "./TimeCalculate";
import { NativeModules } from "react-native";

class clsAlarm {
    // Static method example
    static async setAlarm(usertimeid, date, prayertime, hour, minute, label) {
      const { AlarmModule } = NativeModules;
      const timeCalculate = new TimeCalculate();
    
      try {
        // حساب وقت المنبه
        const alarmTime = timeCalculate.calculateAlarmTime(date, prayertime, hour, minute);
        console.log('Alarm Time:', alarmTime);
    
        if (!alarmTime) {
          console.log("❌ فشل في حساب وقت المنبه.");
          throw new Error("Failed to calculate alarm time.");
        }
    
        // حفظ المنبه والحصول على ID
        const alarmId = await addAlarm(
          alarmTime.finalDate,
          alarmTime.finalHour,
          alarmTime.finalMinute,
          usertimeid
        );
    
        console.log("✅ حفظ المنبه بنجاح:", alarmId);
    
        // تعيين المنبه باستخدام native module
        AlarmModule.setAlarm(
          alarmId,
          alarmTime.finalDate,
          alarmTime.finalHour,
          alarmTime.finalMinute,
          label
        );
    
        console.log(`⏰ Alarm set for ${usertimeid} at ${alarmTime.finalHour}:${alarmTime.finalMinute} (${label})`);
      } catch (error) {
        console.error("❌ Error setting alarm:", error.message);
        throw error; // هذا سيمرّر الخطأ إلى الدالة التي استدعت setAlarm
      }
    }
    

    static async cancelAlarm(usertimeid) {
      const { AlarmModule } = NativeModules;
      console.log("usertimeid:", usertimeid);
    
      try {
        // جلب المنبهات أولاً
        console.log("🔍 Fetching alarms...");
        const alarms = await getAlarmsByUserTimeId(usertimeid);
        console.log("Alarms:", alarms);
    
        // تحقق إذا كانت المنبهات فارغة أو غير موجودة
        if (!alarms || alarms.length === 0) {
          console.log('No alarms found for this user_time_id.');
          return;
        }
    
        // إلغاء كل المنبهات في قائمة المنبهات
        for (const alarm of alarms) {
          try {
            await AlarmModule.cancelAlarm(alarm.id); // استدعاء Native Module لإلغاء المنبه
            console.log(`✅ Alarm ${alarm.id} cancelled successfully.`);
          } catch (e) {
            console.warn(`❌ Failed to cancel alarm ${alarm.id}:`, e);
            throw e;
          }
        }
    
        // حذف المنبهات من قاعدة البيانات
        await deleteAlarmByUserTime(usertimeid);
        console.log('✅ Alarms deleted from DB');
    
      } catch (error) {
        console.error('❌ Error canceling alarm:', error);
        throw error; // تمرير الخطأ ليتم معالجته في الدالة الرئيسية
      } finally {
        // حذف الـ userTime في الـ finally للتأكد من تنفيذه دائمًا
        try {
          await deleteUserTime(usertimeid);
          console.log('🧹 User Time deleted');
        } catch (err) {
          console.warn('⚠️ Failed to delete user time:', err);
        }
      }
    }
    
    
    
}



export default clsAlarm;