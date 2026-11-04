# تقرير تسليم: منبه الصلاة v2

> **إلى Claude في الجلسة القادمة:** اقرأ هذا التقرير كاملاً، ثم `docs/PLAN.md` (الخطة الأصلية المعتمدة). المستخدم يكتب بالعربية؛ أجبه بالعربية.
> **آخر تحديث:** 2026-11-05 — جلسة على macOS. الفرع `feature/prayer-alarms-v2` عند `6dab3ca` (+ commit هذا التقرير).
> **الحالة:** المراحل 0، 1 (كاملة)، 2، 3أ منفَّذة. **التالي: 3ب (Android أصلي)** — بانتظار قرار المستخدم (القسم 7).

---

## 1. ملخص جلسة الماك (2026-11-04/05)

1. **الإعداد على الماك** وتشغيل التطبيق لأول مرة منذ بداية v2 (محاكي iOS 18.3، Xcode 16.2).
2. **التحقق من 1·3أ:** الإشعار يصل والتطبيق مقتول. **خلل وُجد وأُصلح** (`06a13e8`): `notifee.setNotificationCategories` كان يمسح فئات الغفوة/الإيقاف فلا تظهر الأزرار. بعد الإصلاح **جرّب المستخدم بنفسه: الأزرار والغفوة تعمل**.
3. **`Podfile.lock`** كان قديماً في المستودع (بلا MMKV) → حُدّث (`8ffbc39`).
4. **1·3ب — حذف notifee بالكامل** في 3 commits (`6debacf`, `24751ba`, `d1a4f1a`). CI أخضر على `d1a4f1a`.
5. **3أ — ربط `src/core` بالجدولة** في commitين (`2ec5221`, `6dab3ca`). CI أخضر على `6dab3ca` (Lint+Jest، Android، iOS).

---

## 2. المشروع والإعداد

- **React Native CLI (bare) 0.78.0** — ليس Expo. New Architecture مفعّلة على المنصتين.
- المستودع: `https://github.com/Yousf316/AlarmApp` (عام). الفرع: `feature/prayer-alarms-v2`. **لا تدمج في `main` دون طلب المستخدم.**
- Bundle ID: `com.yousef.alarmapp`، Team: `Z8V6T9666Y`، iOS deployment target 15.1.

### الإعداد على هذا الماك (مُجرَّب)
```bash
git pull
npm ci
export LANG=en_US.UTF-8
cd ios && /usr/local/bin/pod install && cd ..   # CocoaPods 1.16.2 العام — انظر الملاحظة
npx jest                                        # المتوقع: 15 suites, 142 tests
npx react-native start                          # Metro (في الخلفية)
# بناء وتشغيل على المحاكي (iPhone 16 Pro, id 09EC047D-5FDF-4A77-BBAE-84507D93480F):
cd ios && xcodebuild -workspace AlarmApp.xcworkspace -configuration Debug -scheme AlarmApp \
  -destination id=09EC047D-5FDF-4A77-BBAE-84507D93480F build
xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/AlarmApp-*/Build/Products/Debug-iphonesimulator/AlarmApp.app
xcrun simctl launch booted com.yousef.alarmapp
```
- **لا تستخدم `bundle exec pod install` محلياً:** `Gemfile` يثبّت `xcodeproj < 1.26` فيُختار CocoaPods 1.15.2، ومع Xcode 16.2 يفشل pod `react-native-sqlite-storage` بـ `React-Core.modulemap not found`. Ruby النظام 2.6 لا يصلح؛ Ruby 3.4 من Homebrew في `/usr/local/opt/ruby/bin`.
- `pod install` يعدّل `ios/AlarmApp.xcodeproj/project.pbxproj` **شكلياً** → `git checkout -- ios/AlarmApp.xcodeproj/project.pbxproj` ولا تلتزم به.
- `npx react-native run-ios` يخفي أخطاء البناء الحقيقية؛ استعمل `xcodebuild` مباشرة واقرأ أسطر `error:`.
- **لا Android SDK ولا Java ولا محاكي Android** على هذا الماك → Android يُتحقق منه عبر CI فقط.

---

## 3. ما أُنجز

| Commit | المرحلة | المحتوى | CI |
|---|---|---|---|
| `70f36fc` … `de5cb14` | 0 – 2 | baseline، CI، New Arch، MMKV v3 + هجرة SQLite، `PrayerAlarmModule`، المنطق الصرف `src/core`، إصلاحات بناء iOS (من جلسة Windows) | ✅ |
| `ded46f7` | docs | تقرير التسليم والخطة | — |
| `06a13e8` | 1·3أ | إصلاح: إعادة تسجيل فئات الأزرار بعد أن يمسحها notifee | ✅ |
| `8ffbc39` | build | تحديث `Podfile.lock` (MMKV 3.3.3، حذف get-random-values) | (أُلغي بدفع لاحق؛ مغطى بـ `d1a4f1a`) |
| `6debacf` | 1·3ب | Android: تذكير التجديد بـ Kotlin (`ReminderReceiver`) + `POST_NOTIFICATIONS` من JS | Android ✅ |
| `24751ba` | 1·3ب | iOS يجدول عبر `PrayerAlarmModule` (`cancelLegacy`، `clearDelivered`، `schedule({plain})`) | (مغطى بـ `d1a4f1a`) |
| `d1a4f1a` | 1·3ب | حذف `@notifee/react-native` وكل الحلول المؤقتة (re-assert، guard، maven repo) | ✅ الثلاثة |
| `2ec5221` | 3أ | `window.js`، `reconciler.js`، `adapters.js`، `scheduleStore.js`، `format.js` + اختبارات | (مع التالي) |
| `6dab3ca` | 3أ | `clsAlarm` فوق `src/core` + الترحيل + `CoverageBanner` | ✅ الثلاثة ([run](https://github.com/Yousf316/AlarmApp/actions/runs/41911326324)) |

### البنية الحالية للجدولة
- `src/librarys/clsAlaram.js` — واجهة رقيقة بنفس الـ API للشاشات: `rescheduleAll()` (بلا وسائط الآن)، `cancelAlarm(userTimeId)`، `cancelAll()`، `clearLegacyScheduled()`.
- `src/core/alarms/`
  - `model.js` — `normalizeAlarm`، `fromLegacyUserTime` (غفوة 5 د بلا حد للمنبهات القديمة).
  - `planner.js` — `planOccurrences`: ids حتمية `alarmId|dateKey|prayer`، `fingerprint`، `nid` (int لـ Android).
  - `window.js` — iOS: `57 منبه + 2 تذكير + 5 احتياطي غفوة = 64`؛ كل غفوة معلقة فوق الخمس تأخذ مكان منبه. Android: 450. `coverageUntil` = آخر منبه. التذكيران `renew-1` (قبل الانتهاء بـ24 س) و`renew-2` (بعده بدقيقة).
  - `reconciler.js` — diff بالـ id والـ fingerprint؛ تنظيف السجل مقابل `getPendingIds` (iOS) أو بالوقت (Android). لا تغيير ⇒ صفر استدعاءات أصلية.
  - `adapters.js` — iOS عبر `prayerAlarmNative.js`، Android عبر `NativeModules.AlarmModule`.
  - `scheduleStore.js` — MMKV: `schedule.map`، `schedule.status` (للبانر)، `schedule.v3` (علامة الترحيل).
- `src/core/time/format.js` — "المنبهات مجدولة حتى الاثنين 16 نوفمبر (12 يوماً)" بأسماء عربية ثابتة (لا تعتمد على Intl في Hermes).
- `src/core/prayer/methods.js` — `methodForCountry`: SA→UmmAlQura، EG→Egyptian، AE→Gulf (تطابق ما تعرضه `PrayerScreen`). Gulf بلا fallback محلي.
- `src/components/CoverageBanner.js` — في تبويب "المنبه" (`AlarmList.js`)، تحذيري عند < يومين.
- `PrayerScreen.js` ما زال يعرض الأوقات عبر `loadPrayerTimes` القديم (20 يوماً شهرياً) حتى المرحلة 4.

### الكود الأصلي
- **iOS:** `ios/AlarmApp/PrayerAlarmModule.swift` + `.m`. `PrayerAlarmCenter` هو المالك الوحيد لـ `UNUserNotificationCenter.delegate` (يُعيَّن في `AppDelegate` قبل `super`). JS API: `getPermissionStatus`، `requestPermission`، `schedule({id, fireAt, title, body, sound, snoozeMinutes, maxSnooze, plain})`، `cancel(ids)`، `cancelAll(includeSnoozes)`، `cancelLegacy()`، `clearDelivered()`، `getPendingIds()`. الغفوة أصلية بعدّاد في `userInfo` (`maxSnooze 0` = بلا حد)، والأزرار بلا `.foreground`. فئات: `alarm.snooze.1…60` و`alarm.nosnooze`.
- **Android:** `AlarmModule.kt` (`setAlarm/cancelAlarm/cancelAll/scheduleReminder/cancelReminder/canScheduleExactAlarms`)، `AlarmScheduler.kt` (`setAlarmClock` + حفظ في SharedPreferences واستعادة بعد الإقلاع، والتذكيرات بـ `setAndAllowWhileIdle`)، `ReminderReceiver.kt` (قناة `renew`)، `AlarmService.kt` (رنين بـ MediaPlayer)، `AlarmActivity`، `BootReceiver`. **لا غفوة على Android بعد** (3ب).

---

## 4. قرارات مهمة

1. **notifee حُذف** (مؤرشف). iOS: Swift module خاص؛ Android: Kotlin. الإذن: iOS عبر `PrayerAlarmModule.requestPermission`، Android 13+ عبر `PermissionsAndroid`.
2. **الترحيل من الأنظمة القديمة:**
   - منبهات notifee (ids مختلفة) يزيلها `cancelLegacy()` = كل طلب معلّق بلا `prayerAlarm=true`.
   - منبهات 1·3ب (`alarm-<n>`، `renew-reminder`) يزيلها ترحيل 3أ لمرة واحدة (`schedule.v3`)، **ولا يعمل إلا إذا توفرت المواقيت** (لا يُترك المستخدم بلا منبهات عند انقطاع الشبكة).
3. **MMKV v3 بدل v4** (v4/Nitro لا يُبنى على iOS مع RN 0.78).
4. **`react-native-sqlite-storage` باقٍ** لأن هجرة SQLite → MMKV تقرأ القاعدة القديمة. احذفه لاحقاً بعد فترة كافية.
5. **`Podfile` → `post_install`:** pod `fmt` بـ `c++17` و`FMT_USE_CONSTEVAL=0` (لازم لـ Xcode 26). لا تحذفه.
6. **الصوت:** الكود يطلب `radar.caf` وهو غير موجود → الصوت الافتراضي. يوجد `ios/Resources/radar.mp3` (غير مضاف للـ target). المستخدم أضاف محلياً `ios/Resources/alarmios.wav` (22.8 ث، 4 MB، **غير متتبَّع**) — لم يُقرَّر استخدامه (يفضَّل تحويله لـ CAF ≤30 ث؛ حقوق الاستخدام غير مؤكدة).
7. **زر "منبه تجريبي بعد 10 ثوانٍ"** في `AlarmList` (iOS) مؤقت؛ ينتقل لشاشة الإعدادات في المرحلة 4.
8. **`rescheduleAll` يُستدعى عند:** الإقلاع، العودة للمقدمة، إضافة منبه، تغيير المدينة. رخيص عندما لا يتغير شيء.

---

## 5. ما لم يُتحقق منه بعد

- **Android وقت التشغيل إطلاقاً:** التذكيران (`ReminderReceiver`)، طلب الإذن من JS، الجدولة الجديدة بـ `nid`. CI يبني فقط.
- **أزرار الغفوة بعد حذف notifee و3أ:** جُرّبت قبلهما؛ الكود الأصلي للغفوة لم يتغير، لكن يُستحسن أن يجرّب المستخدم المنبه التجريبي مرة (الضغط المطوّل لا يمكن محاكاته من هنا).
- نداء Aladhan الحقيقي `annual=true` على شبكة حقيقية (الجدول المحفوظ جاء من مكان ما، لكن لم يُفحص مصدره: `schedule.status.source`).
- هجرة SQLite → MMKV على بيانات حقيقية.
- الصوت، الوضع الصامت، Focus، AlarmKit (جهاز حقيقي — المرحلة 7).

---

## 6. دروس وأدوات (محاكي iOS)

- **السجلات:** `xcrun simctl spawn booted log show --last 5m --info --debug --predicate 'process == "AlarmApp" AND subsystem == "com.apple.UserNotifications"'` — ابحث عن `Got N pending`، `Removing N pending`، `Added notification request`، `Setting N notification categories`. هذا أدق طريقة لعدّ ما جُدول وأُلغي.
- **التحكم بالواجهة:** لا `idb`. استُعمل برنامج Swift صغير يرسل أحداث CGEvent (نقر/سحب) — يحتاج أن يمنح المستخدم Terminal/VS Code صلاحية Accessibility (مُنحت في هذه الجلسة). الأدوات كانت في scratchpad الجلسة وليست في المستودع. التحويل: إحداثيات الجهاز (402×874 pt) → الشاشة عبر موضع عنصر `AXGroup` في نافذة Simulator (اقرأه في كل مرة؛ النافذة تتحرك).
- **الضغط المطوّل على الإشعار لا يعمل بالمحاكاة** → اختبار الأزرار يدوي من المستخدم.
- **الواجهة تتحول إلى RTL بعد أول إقلاع** (`I18nManager.forceRTL` في `PrayerScreen`) فتتبدل أماكن التبويبات — انتبه في E2E.
- **Fast Refresh يعيد تشغيل JS عند حفظ الملفات** والتطبيق مفتوح → قد تجري الجدولة/الترحيل أثناء التعديل. أغلق التطبيق قبل تجارب "أول إقلاع".
- **حالة المحاكي الآن:** منبه واحد "قبل كل الصلوات بـ 00:05" مجدول بالنظام الجديد (59 طلباً)، والمدينة جدة.

---

## 7. الخطوة التالية

**قرار معلّق للمستخدم:** هل نثبّت Android Studio + محاكي على الماك (~8–10 GB) قبل 3ب؟ (في 1·3ب اختار المستخدم "CI فقط"، لكن 3ب كله كود Android لا يمكن التحقق منه وقت التشغيل بدونه.) اسأله، ثم اعرض خطة 3ب للموافقة.

**3ب — Android أصلي:** extras (soundId, style, snoozeMin, maxSnooze, snoozeCount) في `AlarmScheduler`؛ `SnoozeReceiver` أصلي يخفي الزر عند الحد؛ زر غفوة في `AlarmActivity` والإشعار؛ صوت من `res/raw` بـ USAGE_ALARM؛ قناة لكل صوت لنمط "notification"؛ فحص `canUseFullScreenIntent()` قبل كل رنين مع fallback لإشعار IMPORTANCE_HIGH/category ALARM بأزرار؛ دوال أذونات/بطارية/autostart/preview في `AlarmModule`؛ إزالة فتح الإعدادات التلقائي من `MainActivity`. يلزم توسيع `adapters.js` (Android) لتمرير الغفوة والصوت، وتمديد `setAlarm`.

**3ج — iOS أصلي:** عند جدولة غفوة ووصول المعلق إلى 64: يلغي Swift أبعد منبه (غير غفوة) ويزيح التذكيرين (`renew-1/renew-2`) إلى آخر منبه متبقٍ. (JS يعيد ملء النافذة عند الـ reconcile التالي؛ `window.js` يحسب الغفوات المعلقة أصلاً.)

ثم المراحل 4–8 كما في `docs/PLAN.md` (الواجهة الجديدة، AlarmKit، المهام الخلفية، Maestro + TestFlight، Widget اختياري).

---

## 8. تفضيلات المستخدم وطريقة العمل

- **الخطة تُعرض للموافقة قبل أي تغيير كبير** (plan mode)، ثم **commit لكل خطوة** مع تحقق (Jest + build) قبل التالية.
- **لا commit ولا push لملفات لم يطلبها**؛ ملفاته غير المتتبَّعة: `Gemfile.lock` (مولَّد محلياً)، `ios/AlarmApp/AlarmAppDebug.entitlements` (غرضه غير معروف، غير مُشار إليه في المشروع)، `ios/Resources/alarmios.wav`.
- **بعد كل push تحقّق من GitHub Actions بنفسك**؛ `gh` غير مثبت → REST API العام (60 طلباً/ساعة؛ افحص كل ~3 دقائق). استعمل `json.loads(..., strict=False)` (الاستجابة فيها أحرف تحكم). annotations: `GET /repos/Yousf316/AlarmApp/check-runs/{job_id}/annotations`.
- **CI:** `concurrency: cancel-in-progress` → لا تدفع commit جديداً قبل انتهاء تشغيل السابق إن أردت نتيجته. runners الـ macOS تتأخر أحياناً حتى `The job was not acquired by Runner` (ليس خللاً بالكود) → المستخدم يضغط "Re-run failed jobs" (لا نملك توكن).
- اشرح القيود بصدق (ما لم يُختبر، ما يحتاج جهازاً حقيقياً). اطلب منه الخطوات اليدوية (الضغط المطوّل على الإشعار) بتعليمات واضحة.
- لاحقاً لـ TestFlight (المرحلة 7): Apple Developer Program، App ID مع Time Sensitive، App Store Connect API key، مستودع خاص لـ fastlane match، GitHub Secrets. ملفات الأذان الحقيقية لم تُقدَّم بعد.

---

## 9. ملاحظات تقنية

- **Jest:** `jest.setup.js` فيه mocks لـ MMKV (in-memory، يدعم `clearAll`)، sqlite، `NativeModules.AlarmModule` (مع `scheduleReminder/cancelReminder`)، `NativeModules.PrayerAlarmModule` (مع `cancelLegacy/clearDelivered`). `Platform.Version` getter للقراءة فقط في Jest → `Object.defineProperty`.
- **tsc:** خطأ قديم وحيد مقبول: `App.tsx: Parameter 'e' implicitly has an 'any' type`.
- **ESLint:** لا أخطاء؛ تحذيرات قديمة فقط (منها bitwise مقصود في `planner.js`).
- **نهايات الأسطر:** على هذا الماك الملفات LF (بما فيها `project.pbxproj` و`AppDelegate.swift`)، خلافاً لما ذكره تقرير Windows.
- مُعرّفات pbxproj المضافة يدوياً تبدأ بـ `A1000001…A1000005`. `android/gradlew` يحتاج بت التنفيذ (مُعيَّن في git).
