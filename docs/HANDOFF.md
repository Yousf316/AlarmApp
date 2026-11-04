# تقرير تسليم: منبه الصلاة v2 (للمتابعة على macOS)

> **إلى Claude على الماك:** هذا التقرير يكفي لتكمل العمل. اقرأه كاملاً، ثم `docs/PLAN.md` (الخطة المعتمدة من المستخدم). المستخدم يكتب بالعربية؛ أجبه بالعربية.
> آخر تحديث: 2026-11-04 (مساءً، على الماك) — الفرع `feature/prayer-alarms-v2`. **1·3أ مُتحقَّق منها على محاكي iOS و1·3ب (حذف notifee) منفَّذة**؛ انظر القسم 6.

---

## 1. لماذا انتقلنا إلى الماك

العمل السابق تم على Windows، فلم يكن ممكناً:
- ترجمة/تشغيل iOS محلياً (كان التحقق عبر GitHub Actions فقط).
- تشغيل التطبيق فعلياً: محاكي Android على ذلك الجهاز لم يُقلع، فلم يُجرَّب أي شيء وقت التشغيل على أي منصة.

**أول ما يجب فعله على الماك:** تشغيل التطبيق على محاكي iOS والتحقق من المرحلة 1·3أ (القسم 6).

---

## 2. المشروع باختصار

- **React Native CLI (bare) 0.78.0** — ليس Expo. التعديلات الأصلية يدوية في `ios/` و `android/`.
- **New Architecture مفعّلة** على المنصتين (Android عبر `newArchEnabled=true`؛ iOS افتراضياً في 0.78).
- المستودع: `https://github.com/Yousf316/AlarmApp` (عام). الفرع: `feature/prayer-alarms-v2`. لا تدمج في `main` دون طلب المستخدم.
- Bundle ID: `com.yousef.alarmapp`، Team: `Z8V6T9666Y`، iOS deployment target 15.1.

### الإعداد على الماك
```bash
git fetch && git checkout feature/prayer-alarms-v2 && git pull
npm ci
cd ios && bundle install && bundle exec pod install && cd ..
npx jest                      # يجب: 10 suites, 94 tests passing
npx react-native run-ios      # أو افتح ios/AlarmApp.xcworkspace في Xcode
```

---

## 3. ما أُنجز (كل commit مدفوع، و CI أخضر على آخرها)

| Commit | المرحلة | المحتوى |
|---|---|---|
| `70f36fc` | 0 | baseline للعمل السابق |
| `9e632d9` | 1·0 | `.github/workflows/ci.yml`: Lint+Jest، Android `assembleDebug`، iOS simulator build بدون توقيع |
| `517e427` | 1·1 | New Architecture على Android |
| `80ba496` | 1·2 | التخزين: MMKV بدل SQLite بنفس واجهة `database/*` + هجرة لمرة واحدة من SQLite |
| `3c14af8` | 1·3أ | `PrayerAlarmModule` (Swift، UNUserNotificationCenter) **بجانب** notifee |
| `097d700` | 2 | المنطق الصرف في `src/core/` (مواقيت سنوية، fallback محلي، planner) — **غير موصول بالتطبيق بعد** |
| `0569b1b`, `c326b9e` | CI | إصلاحات الـ workflow + عرض أخطاء xcodebuild كـ annotations |
| `2929868` | iOS build | `Podfile`: تعطيل consteval لـ pod `fmt` (لازم مع Xcode 26) |
| `de5cb14` | 1·2 | **MMKV v3 بدل v4** (انظر القسم 4) |

آخر تشغيل CI ناجح بالكامل: https://github.com/Yousf316/AlarmApp/actions/runs/41785112493

### الملفات المهمة
- `src/core/storage/` — `mmkv.js` (غلاف: `getJSON/setJSON/nextId`)، `migrateFromSqlite.js`، `timetableStore.js`.
- `src/core/time/zone.js` — مفاتيح الأيام بمنطقة **المدينة** (Luxon)، لا منطقة الجهاز.
- `src/core/prayer/` — `methods.js` (أم القرى افتراضياً ↔ Aladhan id ↔ adhan)، `aladhan.js` (جلب سنة كاملة `annual=true&iso8601=true`)، `localCalc.js` (adhan)، `cities.js` (إحداثيات مدمجة)، `timetableRepo.js` (`getTimetable`/`needsRefresh`/`coverageDays`).
- `src/core/alarms/` — `model.js` (`normalizeAlarm`, `fromLegacyUserTime`)، `planner.js` (`planOccurrences`, ids حتمية، `fingerprint`، `nid` لـ Android)، `prayerAlarmNative.js` (غلاف JS لـ Swift module).
- `ios/AlarmApp/PrayerAlarmModule.swift` + `.m` + `AlarmApp.entitlements` (Time Sensitive)، و `AppDelegate.swift` (يستدعي `PrayerAlarmCenter.shared.install()` قبل `super`). الدوال: `getPermissionStatus/requestPermission/schedule({plain})/cancel/cancelAll/cancelLegacy/clearDelivered/getPendingIds`.
- Android: `AlarmModule.kt` (`setAlarm/cancelAlarm/cancelAll/scheduleReminder/cancelReminder/canScheduleExactAlarms`) + `ReminderReceiver.kt` لتذكير التجديد (كان notifee).
- التطبيق الحالي ما زال يجدول عبر `src/librarys/clsAlaram.js` بنموذج `user_times` القديم، لكن **عبر الكود الأصلي فقط**: `PrayerAlarmModule` على iOS و`AlarmModule` على Android. لا notifee في أي مكان.

---

## 4. قرارات وانحرافات عن الخطة (مهمة)

1. **مكتبة الإشعارات:** Notifee أُرشف (أبريل 2026) فحُذف بالكامل (1·3ب). القرار: **Swift module خاص** (`PrayerAlarmModule`) على iOS و Kotlin على Android. إذن الإشعارات: iOS عبر `PrayerAlarmModule.requestPermission`، و Android 13+ عبر `PermissionsAndroid` (حُذف الطلب الأصلي والـ Toast من `MainActivity`).
2. **ملكية الـ delegate:** `PrayerAlarmCenter` هو المالك الوحيد لـ `UNUserNotificationCenter.delegate`، يُعيَّن في `didFinishLaunching` قبل JS. حُذفت حلول notifee المؤقتة (re-assert، `ensureCategories`، التمرير لـ legacy delegate، `notifeeGuard.js`).
   - **ترحيل المنبهات القديمة:** منبهات notifee المعلقة لها ids مختلفة، فيزيلها `cancelLegacy()` (كل معلّق ليس عليه `prayerAlarm=true`) عند أول `rescheduleAll`. تحقق على المحاكي: 61 طلباً قديماً أُزيلت وجُدول 61 أصلياً بلا تراكم عند إعادة التشغيل.
   - **تذكير التجديد:** iOS إشعار `plain` (بلا أزرار، `.active`)، و Android `AlarmModule.scheduleReminder` (AlarmManager غير exact، يُستعاد بعد الإقلاع).
3. **أزرار الغفوة/الإيقاف** بلا `.foreground`؛ الغفوة تُجدول **أصلياً** في Swift بعدّاد في `userInfo` (`maxSnooze 0` = بلا حد، `snoozeMinutes 0` = بلا زر). categories: `alarm.snooze.1…60` و `alarm.nosnooze`، تُدمج مع categories الموجودة.
4. **MMKV v3 بدل v4:** v4 يعتمد على `react-native-nitro-modules` الذي لا يُبنى على iOS مع RN 0.78 (`import of module 'glog.glog.log_severity' appears within namespace 'google'`). v3 = TurboModule بنفس المحرك. الـ API: `new MMKV({id})`.
5. **`react-native-sqlite-storage` لم يُحذف:** الهجرة تحتاجه لقراءة القاعدة القديمة. احذفه لاحقاً (مثلاً مع 1·3ب) بعد فترة كافية.
6. **`Podfile` → `post_install`:** pod `fmt` يُبنى بـ `c++17` و `FMT_USE_CONSTEVAL=0` (وإلا يفشل مع Xcode 26). لا تحذف هذا.
7. **ملف الصوت:** يوجد `ios/Resources/radar.mp3` فقط، وهو غير مُضاف للـ target. iOS لا يشغّل mp3 للإشعارات → الصوت الافتراضي حالياً. على الماك يمكن التحويل: `afconvert -f caff -d LEI16 radar.mp3 radar.caf` (≤30 ث) وإضافته لـ Copy Bundle Resources.
8. **زر "منبه تجريبي بعد 10 ثوانٍ"** في `AlarmList` (iOS فقط) — **مؤقت** للتحقق، ينتقل لشاشة الإعدادات في المرحلة 4.

---

## 5. ما لم يُتحقق منه بعد

- **Android وقت التشغيل:** لا يوجد Android SDK/Java/محاكي على الماك. CI يبني `assembleDebug` فقط. تذكير التجديد (`ReminderReceiver`) وطلب `POST_NOTIFICATIONS` من JS لم يُجرَّبا فعلياً؛ يلزم جهاز أو محاكي.
- نداء Aladhan الحقيقي بصيغة `annual=true` (fallback المحلي يغطي أي اختلاف).
- هجرة SQLite → MMKV على بيانات حقيقية.
- الصوت والوضع الصامت وFocus وAlarmKit (جهاز حقيقي — TestFlight، المرحلة 7). الصوت الحالي الافتراضي لأن `radar.caf` غير موجود.

## 6. حالة التحقق ودروس 1·3أ/1·3ب (محاكي iOS 18.3، Xcode 16.2)

- ✅ الإشعار يصل والتطبيق مقتول، وأزرار الغفوة/الإيقاف تعمل (تجربة المستخدم)، والغفوة أصلية.
- ✅ **خلل وُجد وأُصلح (`06a13e8`):** `notifee.setNotificationCategories` يستبدل كل الفئات فتختفي الأزرار. زال بحذف notifee.
- ✅ بعد 1·3ب: لا تحذير delegate، ولا `Setting 1 notification categories`، والترحيل من منبهات notifee يعمل (أعلاه).
- ⚠️ أدوات التحكم بالمحاكي من هنا: لا `idb`. نقر بأحداث CGEvent (يحتاج منح Terminal صلاحية Accessibility)؛ الضغط المطوّل على الإشعار لا يعمل بالمحاكاة، فاختبار الأزرار يدوي.
- ⚠️ الواجهة تتحول إلى RTL **بعد أول إقلاع** (تبدّل التبويبات)؛ انتبه عند كتابة اختبارات E2E.
- بيئة البناء المحلي: `bundle exec pod install` يختار CocoaPods 1.15.2 (`Gemfile` يثبّت `xcodeproj < 1.26`) وعلى Xcode 16.2 يفشل pod sqlite بـ `React-Core.modulemap not found`. الحل: `/usr/local/bin/pod install` (1.16.2). على CI لا تظهر المشكلة (Xcode 26). `pod install` يعدّل `project.pbxproj` شكلياً — لا تلتزم به.
- CI: runners الـ macOS تتأخر أحياناً حتى تُلغى المهمة بـ `The job was not acquired by Runner` — ليس خللاً بالكود؛ أعد تشغيل المهمة. و`cancel-in-progress` يلغي تشغيل الـ commit السابق عند push جديد.

**الخطوة التالية:** المرحلة 3أ (القسم 7). `react-native-sqlite-storage` يبقى للهجرة.

---

## 7. المرحلة 3 (التصميم الذي اتُّفق عليه، لم يُكتب منه كود)

قسّمها إلى commits:

**3أ — ربط المنطق الجديد بالجدولة (JS):**
- أبقِ واجهة `clsAlarm` (`rescheduleAll`, `cancelAlarm(userTimeId)`, `cancelAll`, `clearLegacyScheduled`) حتى لا تتغير الشاشات قبل المرحلة 4؛ نفّذها فوق `src/core`. المستهلكون: `App.tsx`، `src/components/AlarmList.js`، `src/components/PrayerScreen.js` (الأخير يستخدم `loadPrayerTimes` القديم للعرض — يُستبدل في المرحلة 4).
- المنبهات مؤقتاً من `user_times` عبر `fromLegacyUserTime` (المرحلة 4 تضيف مستودع منبهات جديد وواجهة).
- نافذة iOS: `64 = 57 منبه + 2 تذكير (قبل الانتهاء بـ24 ساعة + عند الانتهاء) + 5 احتياطي غفوة`؛ إن وُجدت غفوات معلقة أكثر من 5 تُنقص النافذة بالفارق. Android حتى 450.
- diff بالـ id + fingerprint (نفس id وبصمة مختلفة = إلغاء + إعادة). خريطة المجدول في MMKV؛ على iOS نظّفها مقابل `getPendingIds()` (ما أُطلق أو أسقطه النظام).
- `coverageUntil` = آخر منبه مجدول فعلاً؛ اعرضه في الرئيسية: "المنبهات مجدولة حتى الخميس 12 نوفمبر (6 أيام)"، بلون تحذيري عند < يومين.
- أول تشغيل: نظّف الجدولة القديمة (notifee ids `alarm-*` و `renew-reminder`، و `AlarmModule.cancelAll()` على Android).
- اختبارات Jest المطلوبة صراحة من المستخدم: 57+2+5 ≤ 64، تغيّر offsetMin/الصوت لنفس id، امتلاء احتياطي الغفوة، `coverageUntil` وتوقيت التذكيرين.

**3ب — Android أصلي:** extras (soundId, style, snoozeMin, maxSnooze, snoozeCount) في `AlarmScheduler`؛ `SnoozeReceiver` أصلي؛ زر غفوة في `AlarmActivity`؛ صوت من `res/raw` بـ USAGE_ALARM؛ قناة لكل صوت؛ فحص `canUseFullScreenIntent()` قبل كل رنين مع fallback لإشعار IMPORTANCE_HIGH/category ALARM بأزرار؛ دوال أذونات/بطارية/autostart/preview في `AlarmModule`؛ إزالة فتح الإعدادات التلقائي من `MainActivity`.

**3ج — iOS أصلي:** عند جدولة غفوة ووصول المعلق إلى 64: إلغاء أبعد منبه (غير غفوة) في Swift وإزاحة التذكيرين (ids ثابتة) إلى آخر منبه متبقٍ.

ثم المراحل 4–8 كما في `docs/PLAN.md`.

---

## 8. تفضيلات المستخدم وطريقة العمل

- **commit لكل مرحلة/خطوة** مع تحقق (Jest + build) قبل التالية؛ الخطة تُعرض للموافقة قبل التغييرات الكبيرة.
- **بعد كل push تحقّق من GitHub Actions بنفسك** — لا تطلب من المستخدم نسخ النتائج. إن لم يكن `gh` مسجلاً: الـ REST API العام (60 طلباً/ساعة بلا توثيق — افحص كل 3–4 دقائق، ولا تكرر بحلقة سريعة). خطوة "Surface build errors" في CI تطبع أسطر `error:` كـ annotations: `GET /repos/Yousf316/AlarmApp/check-runs/{job_id}/annotations`.
- اشرح القيود بصدق (ما لم يُختبر، ما يحتاج جهازاً حقيقياً).
- ما يحتاجه المستخدم لاحقاً لـ TestFlight مذكور في `docs/PLAN.md` (المرحلة 7): Apple Developer Program، App ID مع Time Sensitive، App Store Connect API key، مستودع خاص لـ fastlane match، GitHub Secrets.
- ملفات الأذان الحقيقية لم يقدّمها المستخدم بعد (مع حقوق الاستخدام).

---

## 9. ملاحظات تقنية متفرقة

- Jest: `jest.setup.js` يحوي mocks لـ notifee و MMKV (in-memory) و sqlite و `NativeModules.AlarmModule` و `NativeModules.PrayerAlarmModule`.
- كثير من الملفات بنهايات أسطر مختلطة (Git يحوّل LF→CRLF). `ios/AlarmApp.xcodeproj/project.pbxproj` و `AppDelegate.swift` بـ **CRLF** — حافظ عليها عند التعديل أو استخدم Xcode.
- مُعرّفات pbxproj المضافة يدوياً تبدأ بـ `A1000001…A1000005`.
- `android/gradlew` يحتاج بت التنفيذ (مُعيَّن في git).
- Lint: لا أخطاء، تحذيرات تنسيق قديمة فقط.
