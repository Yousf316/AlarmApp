> نسخة من الخطة المعتمدة. التعديلات التي طرأت أثناء التنفيذ موثّقة في `docs/HANDOFF.md` (أهمها: MMKV **v3** بدل v4).

# خطة: منبه الصلاة v2 — موثوقية كاملة على iOS و Android

## Context
المشروع **React Native CLI (bare) 0.78** — ليس Expo، لذا التعديلات الأصلية تتم يدوياً في `ios/` و `android/` (لا config plugins).
الوضع الحالي:
- **الإشعارات:** `@notifee/react-native` 9.1.8 (أُرشف أبريل 2026) لـ iOS فقط؛ Android يستخدم كود أصلي خاص (`AlarmScheduler.kt` بـ `setAlarmClock`، `AlarmService.kt` foreground service + MediaPlayer، `AlarmActivity` full-screen، `BootReceiver`).
- **التخزين:** `react-native-sqlite-storage` (غير مُصان) — `database/db.js`, `userTimeService.js`, `alarmService.js`, `settingsService.js`.
- **المواقيت:** Aladhan `calendarByCity` شهرياً لـ 20 يوماً + cache (`api/prayerTimes.js`, `src/librarys/prayerData.js`). لا حساب محلي.
- **نموذج المنبه:** "قبل الصلاة بـ ساعة:دقيقة" لمجموعة صلوات فقط؛ لا "بعد"، لا أيام، لا أصوات، غفوة ثابتة 5 د (iOS فقط)، لا غفوة على Android.
- `newArchEnabled=false`، 17 اختبار Jest ناجح، 27 ملف معدّل غير مُلتزم.

القرارات المعتمدة: New Architecture، الهجرة إلى **MMKV v4**، التحقق من iOS عبر **GitHub Actions macOS + TestFlight**، commit أساسي على فرع جديد، **Swift module خاص بدل أي مكتبة إشعارات**.

## توافق المكتبات مع New Architecture (فُحص في node_modules)
| المكتبة | الحالة |
|---|---|
| datetimepicker 8.3, picker 2.11, gesture-handler 2.24, reanimated 3.17, safe-area-context 5.3, screens 4.9, vector-icons 10.3 | ✅ codegen أصلي |
| react-native-paper 5.13 | ✅ JS فقط |
| react-native-get-random-values 1.11 | ⚠️ legacy، يعمل عبر interop (أتحقق إن كان مستخدماً وأحذفه إن لا) |
| @notifee/react-native 9.1.8 | ⚠️ legacy، interop فقط — يبقى مؤقتاً حتى 1·3ب |
| react-native-sqlite-storage 6.0.1 | ⚠️ legacy — يُحذف في 1·2 |
| AlarmModule (Kotlin) | يعمل عبر interop؛ لا حاجة لتحويله لـ TurboModule الآن |
| جديدة: mmkv v4، background-fetch، geolocation، adhan، luxon | أتحقق من `codegenConfig`/التوثيق قبل التثبيت؛ adhan و luxon JS فقط |

## مقارنة: react-native-notify-kit مقابل UNUserNotificationCenter في Swift
| المعيار | notify-kit | Swift module خاص |
|---|---|---|
| الصيانة | fork بمطوّر واحد "best-effort"، نواة Notifee القديمة؛ مخاطرة انقطاع | كودنا (~300 سطر) على API أبل المستقر |
| الغفوة/الإيقاف | يتطلب إقلاع JS في الخلفية ثم الجدولة — قد يتأخر أو يُقتل | `didReceive response` في Swift يجدول الغفوة أصلياً فوراً حتى لو التطبيق مقتول |
| التكامل مع AlarmKit | مكتبتان تتنافسان على `UNUserNotificationCenter.delegate` | module واحد يدير AlarmKit والإشعارات وميزانية الـ 64 |
| Android | غير لازمة: المنبهات والقنوات بـ Kotlin، POST_NOTIFICATIONS بـ `PermissionsAndroid` | — |
| العيب | — | كود أصلي أكثر، يُترجم فقط في CI (Mac) |

**التوصية:** `PrayerAlarmModule` (Swift) + Kotlin الحالي، بنفس واجهة JS على المنصتين (`schedule/cancel/listPending/requestPermission/getSettings/previewSound`).

## المكتبات
| الغرض | الاختيار |
|---|---|
| إشعارات iOS | Swift module خاص (UNUserNotificationCenter) |
| قنوات/أذونات Android | Kotlin + `PermissionsAndroid` |
| منبهات Android | الكود الأصلي الحالي مُطوَّراً (`setAlarmClock`) |
| AlarmKit (iOS 26+) | نفس الـ Swift module |
| حساب محلي | `adhan` (UmmAlQura) |
| التخزين | `react-native-mmkv` v4 + `react-native-nitro-modules` |
| مهام خلفية | `react-native-background-fetch` (BGTaskScheduler + headless Android + startOnBoot) |
| الموقع | `@react-native-community/geolocation` + وضع مدينة يدوي |
| المنطقة الزمنية | `luxon` (حسابات بمنطقة المدينة لا الجهاز) |
| معاينة الصوت | دالة في الـ native module (MediaPlayer / AVAudioPlayer) |
| E2E | Maestro |

## نموذج البيانات (MMKV، JSON)
- `alarms[]`: `{id, prayer, kind:'before'|'after'|'adhan', offsetMin, enabled, days:[0..6], soundId, style:'alarm'|'notification', snoozeMin, maxSnooze}`
- `settings`: `{location:{mode:'gps'|'city', lat,lng,city,country,tz}, method:'UmmAlQura', adjustments:{Fajr:0,...}, onboardingDone}`
- `timetable`: `{key(hash: موقع+طريقة), tz, source:'api'|'local', fetchedAt, days:{'YYYY-MM-DD':{Fajr:ms,...}}}` — التعديلات اليدوية تُطبَّق عند التخطيط (دون إعادة جلب).
- `scheduled`: خريطة id حتمي → occurrence (للـ diff).
- هجرة لمرة واحدة من SQLite (`user_times` → منبهات "before"، `settings.location`) ثم حذف المكتبة.

## البنية الجديدة (`src/core/`)
- `storage/mmkv.js`, `storage/migrateFromSqlite.js`
- `time/zone.js` (Luxon)
- `prayer/aladhan.js` — جلب سنوي: `/v1/calendar/{year}` (lat/lng) أو `/v1/calendarByCity/{year}`، `iso8601=true`؛ السنة التالية عند اقتراب نهايتها.
- `prayer/localCalc.js` — adhan + قائمة مدمجة لإحداثيات المدن الرئيسية للـ fallback في وضع المدينة.
- `prayer/timetableRepo.js` — API → fallback محلي → cache؛ `needsRefresh()` إذا التغطية < 45 يوماً أو تغيّر المفتاح/المنطقة.
- `alarms/planner.js` (pure) — occurrences مرتبة؛ قبل/بعد/أذان، فلتر الأيام (حسب يوم الصلاة)، تجاوز منتصف الليل/الشهر/السنة، ids حتمية `hash(alarmId+date+prayer)`، وكل occurrence يحمل `fireAt` و `fingerprint = hash(fireAt+soundId+style+snoozeMin+maxSnooze)`.
- `alarms/reconciler.js` — diff بالـ id والـ fingerprint معاً (لا cancel-all): نفس الـ id بـ fingerprint مختلف = إلغاء + إعادة جدولة. adapters: `androidAdapter` (AlarmModule)، `iosNotifAdapter` و `iosAlarmKitAdapter` (PrayerAlarmModule).
- `alarms/snooze.js`, `sounds.js` (id، اسم، `ios: x.caf`، `android: raw/x`، channelId `alarm_<id>_v1`)، `permissions.js`, `background.js`.
- يحلّ محل `src/librarys/clsAlaram.js`, `prayerData.js`, `database/*` (تبقى `TimeCalculate.js`/`clsUtilty.js` للعرض).

## المراحل (Jest بعد كل مرحلة + commit لكل مرحلة)

### 0. Baseline
فرع `feature/prayer-alarms-v2` + commit للحالة الحالية.

### 1. الأساس — commits مستقلة، كل واحد يُتحقق منه قبل التالي
- **1·0 CI أولاً:** `.github/workflows/ci.yml` (Jest+lint و `assembleDebug` على ubuntu؛ `pod install` + `xcodebuild` لمحاكي بـ Xcode 26 دون توقيع على macOS).
- **1·1 New Architecture:** `newArchEnabled=true` و `RCT_NEW_ARCH_ENABLED=1` + pod install، دون أي تغيير آخر. التحقق: Jest + `assembleDebug` + تشغيل على محاكي Android (القوائم، التنقل، جدولة منبه) + CI iOS أخضر.
- **1·2 MMKV:** mmkv v4 + nitro-modules، `src/core/storage`، هجرة من SQLite، حذف sqlite-storage. التحقق: اختبارات الهجرة + build المنصتين.
- **1·3أ إضافة Swift module بجانب notifee (دون حذفه):** `PrayerAlarmModule` بـ UNUserNotificationCenter (جدولة، categories، delegate للمقدمة والأزرار، غفوة أصلية). شروط إلزامية:
  - تعيين `UNUserNotificationCenter.current().delegate` في `AppDelegate.didFinishLaunchingWithOptions` (قبل إقلاع JS)، لا من JS — وإلا لا يُستدعى `didReceive response` والتطبيق مقتول.
  - أزرار الغفوة والإيقاف بدون `.foreground` لتُعالَج في الخلفية.
  - notifee لا يعيّن delegate؛ الـ module الجديد هو المالك الوحيد. ملاحظة تقنية: NotifeeCore يعيّن نفسه delegate تلقائياً عند التهيئة، لذا لضمان الشرط يُعيَّن delegate الخاص بنا **بعد** `super.application(...)`، ثم **re-assert** (لا مجرد فحص): عند كل `applicationDidBecomeActive` وبعد أي استدعاء لـ notifee من JS (عبر دالة `PrayerAlarmModule.reassertDelegate()` تُستدعى من غلاف JS حول notifee)، إذا `delegate !== self` يُعاد تعيينه لـ self مع log تحذيري. هذا مؤقت ويُحذف في 1·3ب.
  - التحقق: build iOS أخضر + منبه تجريبي وغفوة على جهاز عبر TestFlight والتطبيق مقتول.
- **1·3ب حذف notifee:** تحويل كل الاستدعاءات للـ module الجديد، POST_NOTIFICATIONS بـ `PermissionsAndroid`، حذف `@notifee/react-native` وrepo الـ maven من `android/build.gradle`. التحقق: Jest (mocks جديدة) + build المنصتين + منبه تجريبي على جهاز.

### 2. المجال (pure logic)
planner + timetableRepo + localCalc + zone + adjustments + mapping طرق الحساب (تطبيق ↔ Aladhan id ↔ adhan method). اختبارات شاملة.

### 3. الجدولة والغفوة والأصوات
- **Rolling window:** iOS ميزانية 64 = 57 منبه + 2 تذكير تجديد (قبل الانتهاء بـ 24 ساعة + عند الانتهاء) + 5 احتياطي غفوة؛ Android حتى 450.
- **امتلاء احتياطي الغفوة (iOS):** يُلغى أبعد منبه في الـ window (لا تُرفض الغفوة أبداً)، ويُحدَّث `coverageUntil` والتذكيران؛ الـ reconcile التالي يعيد الملء.
- **إعادة التوفيق عند:** الفتح/العودة للمقدمة، المهمة الخلفية، أي حدث إشعار يصل للـ JS، تغيّر الإعدادات، تغيّر المنطقة الزمنية المكتشف.
- **Android (Kotlin):** `AlarmScheduler` يحمل extras (soundId, style, snoozeMin, maxSnooze, snoozeCount)؛ `AlarmService` يشغّل `res/raw/<sound>` بـ USAGE_ALARM مع full-screen intent؛ `SnoozeReceiver` أصلي دون JS ويخفي زر الغفوة عند الحد؛ زر غفوة في `AlarmActivity`؛ قناة لكل صوت لنمط "notification"؛ دوال `AlarmModule` جديدة: exact-alarm/full-screen/battery-opt checks + فتح الإعدادات، manufacturer، autostart intents (Xiaomi/Huawei/Samsung/Oppo مع fallback)، `previewSound/stopPreview`. إزالة فتح الإعدادات التلقائي من `MainActivity`.
- **Android 14+ full-screen intent:** فحص `canUseFullScreenIntent()` قبل كل رنين؛ إن رُفض: إشعار IMPORTANCE_HIGH + category ALARM + صوت USAGE_ALARM عبر `AlarmService` بأزرار غفوة/إيقاف، مع عرض الحالة في شاشة الأذونات وزر `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`.
- **iOS (Swift):** categories لكل مدة غفوة + فئة بدون غفوة عند الحد؛ `interruptionLevel = .timeSensitive`؛ غفوة أصلية بعدّاد في `userInfo` وإبلاغ JS عند توفره.
- **مدة التغطية:** `coverageUntil` = آخر منبه مجدول، تُعرض في الرئيسية: "المنبهات مجدولة حتى الخميس 12 نوفمبر (6 أيام)" بلون تحذيري عند < يومين؛ التذكيران يُعاد حسابهما مع كل reconcile.
- **Jest:** window cap (57+2+5 ≤ 64)، diff (تغيّر offsetMin/الصوت لنفس الـ id → إلغاء وإعادة جدولة)، الغفوة والحد، امتلاء الاحتياطي، الأيام، `coverageUntil` وتوقيت التذكيرين.

### 4. الواجهة
قائمة مجمّعة حسب الصلاة مع toggle لكل منبه؛ محرر منبه (الصلاة، قبل/بعد/أذان، دقائق حرة، الأيام، الصوت + معاينة، النمط، مدة وحد الغفوة)؛ الإعدادات (الموقع GPS/مدينة، طريقة الحساب، تعديل ± لكل صلاة، حالة الأذونات، دليل البطارية حسب الشركة، "منبه تجريبي بعد 10 ثوانٍ")؛ onboarding يشرح سبب كل إذن قبل طلبه. testIDs لـ Maestro.

### 5. iOS الأصلي
- AlarmKit في `PrayerAlarmModule.swift`: `isAlarmKitSupported`, `requestAlarmKitAuthorization`, `scheduleAlarm(id,date,title,sound,snoozeMin)`, `cancel`, `listIds`؛ `@available(iOS 26)` مع fallback تلقائي للإشعارات.
- **بدون Widget Extension:** المنبه يعمل بزر إيقاف. الغفوة: زر ثانوي `.custom` + App Intent يجدول منبهاً جديداً بعد N دقيقة (مع حد الغفوة). إن لم يعمل في الخلفية دون widget: زر إيقاف فقط + غفوة عبر إشعار مرافق.
- **الأذان الكامل عبر AlarmKit غير مؤكد:** يُتحقق منه على جهاز (هل يقبل صوتاً مخصصاً، أقصى طول، الصيغة المدعومة) قبل الاعتماد عليه؛ وإلى حين التأكد يُعامل كمقطع ≤30 ث مثل الإشعارات.
- `Info.plist`: `NSAlarmKitUsageDescription`, `NSLocationWhenInUseUsageDescription`, `UIBackgroundModes` (fetch, processing)، `BGTaskSchedulerPermittedIdentifiers`، نصوص عربية. Entitlement Time Sensitive. ملفات `.caf` (≤30 ث) في Copy Bundle Resources.

### 6. المهام الخلفية والمحفزات
background-fetch (~6 ساعات، startOnBoot، headless على Android): refresh + reconcile. `BootReceiver` يستعيد فوراً من SharedPreferences ثم يطلق headless task. كشف تغيّر الموقع (عتبة 5 كم) والمنطقة الزمنية → إعادة جلب وجدولة.

### 7. E2E و TestFlight والتوثيق
- `.maestro/`: إضافة منبه، تغيير صوت، غفوة (عبر المنبه التجريبي) على محاكي Android.
- **TestFlight:** `ios/fastlane/{Fastfile,Appfile,Matchfile}`، lane `beta`: `match(type:"appstore", readonly:true)` → رقم البناء → `build_app` → `upload_to_testflight`. workflow `.github/workflows/ios-testflight.yml` (`workflow_dispatch` + tag `v*`). Android: artifact `assembleRelease`.
- **ما أحتاجه منك:** عضوية Apple Developer Program؛ Bundle ID نهائي مسجّل كـ App ID مع Time Sensitive Notifications و Background Modes؛ سجل التطبيق في App Store Connect؛ API Key (`.p8` + Key ID + Issuer ID، App Manager)؛ مستودع git خاص فارغ لـ match + `MATCH_PASSWORD`؛ GitHub Secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (base64), `MATCH_GIT_URL`, `MATCH_PASSWORD`, `MATCH_GIT_BASIC_AUTHORIZATION`؛ مختبرو TestFlight.
- `docs/TESTING.md`: checklist يدوي لكل منصة (مقفل، صامت، Focus، Doze `adb shell dumpsys deviceidle force-idle`، إعادة تشغيل، تحديث التطبيق، بدون إنترنت، رفض كل إذن، تغيير المنطقة الزمنية، Xiaomi/Samsung).

### 8. (اختياري — أخيراً) Widget Extension لغفوة AlarmKit
target `PrayerAlarmWidget` (Live Activity) لزر غفوة `.countdown` بعدّاد على شاشة القفل. لا يعتمد عليه شيء سابق؛ يُنفَّذ بعد الاستقرار وبموافقتك.

## ملفات رئيسية
`index.js`, `App.tsx`, `package.json`, `jest.setup.js`, `android/gradle.properties`, `android/build.gradle`, `AndroidManifest.xml`, `android/app/src/main/java/com/alarmapp/*.kt` + `SnoozeReceiver.kt`، `android/app/src/main/res/raw/`، `ios/AlarmApp/{Info.plist,AppDelegate.swift}` + `PrayerAlarmModule.swift/.m` + entitlements، `ios/fastlane/*`، `.github/workflows/{ci,ios-testflight}.yml`، `src/components/*`, `src/screens/*`، `src/core/*`.

## التحقق
1. `npx jest` بعد كل مرحلة.
2. `cd android && ./gradlew assembleDebug` بعد المراحل 1، 3، 6.
3. iOS: CI على macOS لكل commit، و TestFlight للأجهزة الحقيقية.
4. Maestro على محاكي Android.
5. checklist يدوي (`docs/TESTING.md`).

## قيود معروفة / مدخلات لاحقة
- **ملفات الأذان:** يوجد `radar.mp3` فقط؛ أحتاج ملفات منك (مع حقوق الاستخدام). الأذان الكامل بالإشعار العادي على iOS مقصوص إلى 30 ث. تشغيله كاملاً عبر AlarmKit (26+) غير مؤكد — يُتحقق على جهاز في المرحلة 5 (صوت مخصص، الطول، الصيغة) قبل الاعتماد عليه؛ وإلى حين التأكد يُعامل كمقطع ≤30 ث.
- iOS: الإشعار العادي لا يُصدر صوتاً في الوضع الصامت (Critical Alerts تحتاج موافقة Apple) — AlarmKit هو الحل على 26+.
- iOS لا يوقظ التطبيق عند وصول إشعار في الخلفية؛ إعادة الجدولة عبر الفتح/المهمة الخلفية/الأزرار + التذكيرين.
- غفوة AlarmKit عبر App Intent دون widget تحتاج تحققاً على جهاز.
- `USE_EXACT_ALARM` مقيّد بسياسة Google Play لتطبيقات المنبه — قد يُطلب تبرير عند النشر.
- كود Swift لن يُترجم إلا في CI — قد تلزم جولة إصلاح بعد أول تشغيل.
