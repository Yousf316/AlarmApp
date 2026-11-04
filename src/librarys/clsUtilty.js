const PRAYER_NAMES_AR = {
  Fajr: 'الفجر',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

class clsUtility {
  // Prevent instantiation
  constructor() {
    throw new Error('clsUtility is a static class and cannot be instantiated.');
  }

  static GetNamePrayerAr = prayerNameEng =>
    PRAYER_NAMES_AR[prayerNameEng] ?? prayerNameEng;
}

export default clsUtility;
