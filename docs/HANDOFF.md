# تقرير تسليم: منبه الصلاة v2 (للمتابعة على macOS)

> **إلى Claude على الماك:** هذا التقرير يكفي لتكمل العمل. اقرأه كاملاً، ثم `docs/PLAN.md` (الخطة المعتمدة من المستخدم). المستخدم يكتب بالعربية؛ أجبه بالعربية.
> آخر تحديث: 2026-11-04 — الفرع `feature/prayer-alarms-v2` عند `de5cb14` (+ commit هذا التقرير).

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
- `src/librarys/notifeeGuard.js` — **مؤقت**: Proxy حول notifee يستدعي `reassertDelegate()` بعد كل استدعاء.
- `ios/AlarmApp/PrayerAlarmModule.swift` + `.m` + `AlarmApp.entitlements` (Time Sensitive)، و `AppDelegate.swift` (يستدعي `PrayerAlarmCenter.shared.install()` قبل `super`).
- التطبيق الحالي ما زال يجدول عبر `src/librarys/clsAlaram.js` (notifee على iOS، `AlarmModule` Kotlin على Android) بنموذج `user_times` القديم.

---

## 4. قرارات وانحرافات عن الخطة (مهمة)

1. **مكتبة الإشعارات:** Notifee أُرشف (أبريل 2026). القرار المعتمد: **Swift module خاص** (`PrayerAlarmModule`) بدل `react-native-notify-kit`، و Kotlin الحالي على Android. notifee يبقى مؤقتاً حتى 1·3ب.
2. **ملكية الـ delegate (شرط المستخدم):** `PrayerAlarmCenter` هو المالك الوحيد لـ `UNUserNotificationCenter.delegate`، يُعيَّن في `didFinishLaunching` قبل JS، ويُعاد تأكيده (re-assert مع log تحذيري) عند كل `didBecomeActive` وبعد كل استدعاء notifee من JS. الإشعارات غير الخاصة بنا (`userInfo.prayerAlarm != true`) تُمرَّر لـ delegate الخاص بـ notifee. **مؤقت حتى 1·3ب.**
3. **أزرار الغفوة/الإيقاف** بلا `.foreground`؛ الغفوة تُجدول **أصلياً** في Swift بعدّاد في `userInfo` (`maxSnooze 0` = بلا حد، `snoozeMinutes 0` = بلا زر). categories: `alarm.snooze.1…60` و `alarm.nosnooze`، تُدمج مع categories الموجودة.
4. **MMKV v3 بدل v4:** v4 يعتمد على `react-native-nitro-modules` الذي لا يُبنى على iOS مع RN 0.78 (`import of module 'glog.glog.log_severity' appears within namespace 'google'`). v3 = TurboModule بنفس المحرك. الـ API: `new MMKV({id})`.
5. **`react-native-sqlite-storage` لم يُحذف:** الهجرة تحتاجه لقراءة القاعدة القديمة. احذفه لاحقاً (مثلاً مع 1·3ب) بعد فترة كافية.
6. **`Podfile` → `post_install`:** pod `fmt` يُبنى بـ `c++17` و `FMT_USE_CONSTEVAL=0` (وإلا يفشل مع Xcode 26). لا تحذف هذا.
7. **ملف الصوت:** يوجد `ios/Resources/radar.mp3` فقط، وهو غير مُضاف للـ target. iOS لا يشغّل mp3 للإشعارات → الصوت الافتراضي حالياً. على الماك يمكن التحويل: `afconvert -f caff -d LEI16 radar.mp3 radar.caf` (≤30 ث) وإضافته لـ Copy Bundle Resources.
8. **زر "منبه تجريبي بعد 10 ثوانٍ"** في `AlarmList` (iOS فقط) — **مؤقت** للتحقق، ينتقل لشاشة الإعدادات في المرحلة 4.

---

## 5. ما لم يُتحقق منه بعد

- **وقت التشغيل على أي منصة** (لم يُشغَّل التطبيق إطلاقاً بعد التعديلات).
- سلوك `PrayerAlarmModule` فعلياً: الإشعار، الغفوة والتطبيق مقتول، re-assert مع notifee.
- نداء Aladhan الحقيقي بصيغة `annual=true` (مكتوب حسب التوثيق ومختبر ببيانات مصنوعة فقط؛ fallback المحلي يغطي أي اختلاف).
- هجرة SQLite → MMKV على بيانات حقيقية.

---

## 6. الخطوة التالية مباشرة: التحقق من 1·3أ على محاكي iOS

1. شغّل على المحاكي، اسمح بالإشعارات، اضغط "منبه تجريبي بعد 10 ثوانٍ"، ثم **أغلق التطبيق تماماً** (swipe up من App Switcher).
2. عند ظهور الإشعار: اضغط مطولاً → يجب أن يظهر "غفوة 1 د" و"إيقاف".
3. "غفوة" → يجب أن يعود الإشعار بعد دقيقة **دون فتح التطبيق**، مرتين كحد أقصى (`maxSnooze: 2`)، ثم بزر "إيقاف" فقط.
4. افحص Console.app (أو `xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "PrayerAlarm"'`) لرسائل `[PrayerAlarm] WARNING: notification delegate was replaced` — ظهورها متوقع عند استدعاءات notifee، والمهم أن الغفوة تعمل بعدها.
5. تأكد أن منبهات notifee القديمة (التي يضيفها التطبيق من "إضافة منبه") ما زالت تظهر وتعمل أزرارها.

> المحاكي يعرض الإشعارات المحلية والأزرار؛ لكن الصوت/الوضع الصامت/Focus/AlarmKit تحتاج جهازاً حقيقياً (TestFlight — المرحلة 7).

إن نجح كل ذلك → **1·3ب**: حذف notifee بالكامل، وحذف `notifeeGuard.js` و re-assert والتمرير لـ legacy delegate، و POST_NOTIFICATIONS بـ `PermissionsAndroid`، وحذف repo الـ maven الخاص بـ notifee من `android/build.gradle`.

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
