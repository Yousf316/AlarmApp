/**
 * Calculation methods: app id ↔ Aladhan API id ↔ adhan-js method name.
 * `adhan: null` means only the API supports it (no local fallback).
 */
export const DEFAULT_METHOD = 'UmmAlQura';

export const METHODS = {
  UmmAlQura: {aladhan: 4, adhan: 'UmmAlQura', ar: 'أم القرى'},
  MuslimWorldLeague: {aladhan: 3, adhan: 'MuslimWorldLeague', ar: 'رابطة العالم الإسلامي'},
  Egyptian: {aladhan: 5, adhan: 'Egyptian', ar: 'الهيئة المصرية'},
  Karachi: {aladhan: 1, adhan: 'Karachi', ar: 'كراتشي'},
  NorthAmerica: {aladhan: 2, adhan: 'NorthAmerica', ar: 'أمريكا الشمالية'},
  Kuwait: {aladhan: 9, adhan: 'Kuwait', ar: 'الكويت'},
  Qatar: {aladhan: 10, adhan: 'Qatar', ar: 'قطر'},
  Singapore: {aladhan: 11, adhan: 'Singapore', ar: 'سنغافورة'},
  Tehran: {aladhan: 7, adhan: 'Tehran', ar: 'طهران'},
  Turkey: {aladhan: 13, adhan: 'Turkey', ar: 'تركيا'},
  Dubai: {aladhan: 16, adhan: 'Dubai', ar: 'دبي'},
  MoonsightingCommittee: {aladhan: 15, adhan: 'MoonsightingCommittee', ar: 'لجنة رؤية الهلال'},
  Gulf: {aladhan: 8, adhan: null, ar: 'منطقة الخليج'},
};

export const resolveMethod = id => (METHODS[id] ? id : DEFAULT_METHOD);
