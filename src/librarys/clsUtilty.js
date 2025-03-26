class clsUtility {
    // Prevent instantiation
    constructor() {
        throw new Error("clsUtility is a static class and cannot be instantiated.");
    }

    // Example static method
    static GetNamePrayerAr = (prayerNameEng) => {
        switch (prayerNameEng) {
          case "Fajr":
            return "الفجر";
          case "Dhuhr":
            return "الظهر";
          case "Asr":
            return "العصر";
          case "Maghrib":
            return "المغرب";
          case "Isha":
            return "العشاء";
        }}

   
}

export default clsUtility;