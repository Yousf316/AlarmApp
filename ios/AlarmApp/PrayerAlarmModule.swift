import Foundation
import UIKit
import UserNotifications
import React

// MARK: - Constants

private let kPrayerFlag = "prayerAlarm"
private let kStopAction = "prayer.stop"
private let kSnoozeAction = "prayer.snooze"
private let kNoSnoozeCategory = "alarm.nosnooze"
private let kSnoozeIdPrefix = "snooze-"
private let kThreadId = "prayer-alarms"

private func snoozeCategoryId(_ minutes: Int) -> String {
  return "alarm.snooze.\(minutes)"
}

private func isOurs(_ userInfo: [AnyHashable: Any]) -> Bool {
  return (userInfo[kPrayerFlag] as? Bool) == true
}

// MARK: - Notification center owner

/// The single owner of `UNUserNotificationCenter.delegate`.
///
/// Snooze / Stop are handled here, natively, so they work even when the app
/// was killed and without booting JS. Notifications that are not ours (the
/// legacy Notifee ones, until Notifee is removed) are forwarded to whichever
/// delegate Notifee installed.
final class PrayerAlarmCenter: NSObject, UNUserNotificationCenterDelegate {
  static let shared = PrayerAlarmCenter()

  private var legacyDelegate: UNUserNotificationCenterDelegate?
  private var forwarding = false
  private var installed = false

  /// Call from `application(_:didFinishLaunchingWithOptions:)`, before JS starts.
  func install() {
    guard !installed else { return }
    installed = true
    assertDelegate(reason: "install")
    registerCategories()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(appDidBecomeActive),
      name: UIApplication.didBecomeActiveNotification,
      object: nil
    )
  }

  @objc private func appDidBecomeActive() {
    assertDelegate(reason: "didBecomeActive")
  }

  /// Re-assert ownership if somebody (Notifee) replaced the delegate.
  /// TEMPORARY: goes away together with Notifee.
  @discardableResult
  func assertDelegate(reason: String) -> Bool {
    let center = UNUserNotificationCenter.current()
    if center.delegate === self {
      return false
    }
    if let other = center.delegate, other !== self {
      legacyDelegate = other
      NSLog(
        "[PrayerAlarm] WARNING: notification delegate was replaced by %@ (%@) - re-asserting",
        String(describing: type(of: other)),
        reason
      )
    }
    center.delegate = self
    registerCategories()
    return true
  }

  /// Registers our categories while keeping the ones others registered
  /// (`setNotificationCategories` replaces everything).
  func registerCategories() {
    let center = UNUserNotificationCenter.current()
    center.getNotificationCategories { existing in
      let stop = UNNotificationAction(identifier: kStopAction, title: "إيقاف", options: [.destructive])
      var ours = Set<UNNotificationCategory>()
      for minutes in 1...60 {
        // No `.foreground`: the action runs in the background, app stays closed.
        let snooze = UNNotificationAction(
          identifier: kSnoozeAction,
          title: "غفوة \(minutes) د",
          options: []
        )
        ours.insert(
          UNNotificationCategory(
            identifier: snoozeCategoryId(minutes),
            actions: [snooze, stop],
            intentIdentifiers: [],
            options: []
          )
        )
      }
      ours.insert(
        UNNotificationCategory(
          identifier: kNoSnoozeCategory,
          actions: [stop],
          intentIdentifiers: [],
          options: []
        )
      )
      let ourIds = Set(ours.map { $0.identifier })
      let others = existing.filter { !ourIds.contains($0.identifier) }
      center.setNotificationCategories(others.union(ours))
    }
  }

  // MARK: Building notifications

  static func makeSound(_ name: String?) -> UNNotificationSound {
    guard let name = name, !name.isEmpty else { return .default }
    return UNNotificationSound(named: UNNotificationSoundName(rawValue: name))
  }

  /// `maxSnooze == 0` means unlimited. `snoozeMinutes == 0` disables snooze.
  static func makeContent(
    title: String,
    body: String,
    sound: String?,
    snoozeMinutes: Int,
    maxSnooze: Int,
    snoozeCount: Int
  ) -> UNMutableNotificationContent {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = makeSound(sound)
    content.interruptionLevel = .timeSensitive
    content.threadIdentifier = kThreadId
    let canSnooze = snoozeMinutes > 0 && (maxSnooze == 0 || snoozeCount < maxSnooze)
    content.categoryIdentifier = canSnooze ? snoozeCategoryId(snoozeMinutes) : kNoSnoozeCategory
    content.userInfo = [
      kPrayerFlag: true,
      "snoozeMinutes": snoozeMinutes,
      "maxSnooze": maxSnooze,
      "snoozeCount": snoozeCount,
      "sound": sound ?? "",
    ]
    return content
  }

  private func scheduleSnooze(from notification: UNNotification, completion: @escaping () -> Void) {
    let info = notification.request.content.userInfo
    let minutes = (info["snoozeMinutes"] as? NSNumber)?.intValue ?? 0
    guard minutes > 0 else {
      completion()
      return
    }
    let maxSnooze = (info["maxSnooze"] as? NSNumber)?.intValue ?? 0
    let count = ((info["snoozeCount"] as? NSNumber)?.intValue ?? 0) + 1
    if maxSnooze > 0 && count > maxSnooze {
      completion()
      return
    }
    let original = notification.request.content
    let content = PrayerAlarmCenter.makeContent(
      title: original.title,
      body: original.body,
      sound: info["sound"] as? String,
      snoozeMinutes: minutes,
      maxSnooze: maxSnooze,
      snoozeCount: count
    )
    let request = UNNotificationRequest(
      identifier: "\(kSnoozeIdPrefix)\(UUID().uuidString)",
      content: content,
      trigger: UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(minutes * 60), repeats: false)
    )
    UNUserNotificationCenter.current().add(request) { error in
      if let error = error {
        NSLog("[PrayerAlarm] failed to schedule snooze: %@", error.localizedDescription)
      }
      completion()
    }
  }

  // MARK: UNUserNotificationCenterDelegate

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if isOurs(notification.request.content.userInfo) {
      completionHandler([.banner, .list, .sound])
      return
    }
    if let legacy = legacyDelegate, !forwarding,
      legacy.responds(
        to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:)))
    {
      forwarding = true
      legacy.userNotificationCenter?(center, willPresent: notification) { [weak self] options in
        self?.forwarding = false
        completionHandler(options)
      }
      return
    }
    completionHandler([.banner, .list, .sound])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let notification = response.notification
    guard isOurs(notification.request.content.userInfo) else {
      if let legacy = legacyDelegate, !forwarding,
        legacy.responds(
          to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:)))
      {
        forwarding = true
        legacy.userNotificationCenter?(center, didReceive: response) { [weak self] in
          self?.forwarding = false
          completionHandler()
        }
        return
      }
      completionHandler()
      return
    }

    let id = notification.request.identifier
    switch response.actionIdentifier {
    case kSnoozeAction:
      center.removeDeliveredNotifications(withIdentifiers: [id])
      scheduleSnooze(from: notification, completion: completionHandler)
    case kStopAction:
      center.removeDeliveredNotifications(withIdentifiers: [id])
      completionHandler()
    default:
      completionHandler()
    }
  }
}

// MARK: - JS module

@objc(PrayerAlarmModule)
final class PrayerAlarmModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  private static func statusDictionary(_ settings: UNNotificationSettings) -> [String: Any] {
    let status: String
    switch settings.authorizationStatus {
    case .notDetermined: status = "notDetermined"
    case .denied: status = "denied"
    case .authorized: status = "authorized"
    case .provisional: status = "provisional"
    case .ephemeral: status = "ephemeral"
    @unknown default: status = "unknown"
    }
    return [
      "status": status,
      "alert": settings.alertSetting == .enabled,
      "sound": settings.soundSetting == .enabled,
      "timeSensitive": settings.timeSensitiveSetting == .enabled,
    ]
  }

  @objc(getPermissionStatus:rejecter:)
  func getPermissionStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      resolve(PrayerAlarmModule.statusDictionary(settings))
    }
  }

  @objc(requestPermission:rejecter:)
  func requestPermission(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let center = UNUserNotificationCenter.current()
    center.requestAuthorization(options: [.alert, .sound]) { _, error in
      if let error = error {
        reject("PERMISSION_ERROR", error.localizedDescription, error)
        return
      }
      center.getNotificationSettings { settings in
        resolve(PrayerAlarmModule.statusDictionary(settings))
      }
    }
  }

  /// item: { id, fireAt (ms), title, body, sound?, snoozeMinutes?, maxSnooze?, snoozeCount? }
  @objc(schedule:resolver:rejecter:)
  func schedule(
    _ item: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let id = item["id"] as? String,
      let fireAtMs = (item["fireAt"] as? NSNumber)?.doubleValue
    else {
      reject("BAD_ARGS", "id and fireAt are required", nil)
      return
    }
    let delay = fireAtMs / 1000.0 - Date().timeIntervalSince1970
    guard delay > 1 else {
      reject("IN_PAST", "Alarm time is in the past", nil)
      return
    }
    let content = PrayerAlarmCenter.makeContent(
      title: (item["title"] as? String) ?? "",
      body: (item["body"] as? String) ?? "",
      sound: item["sound"] as? String,
      snoozeMinutes: (item["snoozeMinutes"] as? NSNumber)?.intValue ?? 0,
      maxSnooze: (item["maxSnooze"] as? NSNumber)?.intValue ?? 0,
      snoozeCount: (item["snoozeCount"] as? NSNumber)?.intValue ?? 0
    )
    let request = UNNotificationRequest(
      identifier: id,
      content: content,
      trigger: UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
    )
    UNUserNotificationCenter.current().add(request) { error in
      if let error = error {
        reject("SCHEDULE_ERROR", error.localizedDescription, error)
      } else {
        resolve(true)
      }
    }
  }

  @objc(cancel:resolver:rejecter:)
  func cancel(
    _ ids: NSArray,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let list = ids.compactMap { $0 as? String }
    let center = UNUserNotificationCenter.current()
    center.removePendingNotificationRequests(withIdentifiers: list)
    center.removeDeliveredNotifications(withIdentifiers: list)
    resolve(true)
  }

  /// Cancels every pending alarm this module scheduled.
  /// Snoozes the user asked for are kept unless `includeSnoozes` is true.
  @objc(cancelAll:resolver:rejecter:)
  func cancelAll(
    _ includeSnoozes: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { requests in
      let ids = requests
        .filter { isOurs($0.content.userInfo) }
        .map { $0.identifier }
        .filter { includeSnoozes || !$0.hasPrefix(kSnoozeIdPrefix) }
      center.removePendingNotificationRequests(withIdentifiers: ids)
      resolve(ids.count)
    }
  }

  @objc(getPendingIds:rejecter:)
  func getPendingIds(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
      resolve(
        requests
          .filter { isOurs($0.content.userInfo) }
          .map { $0.identifier }
      )
    }
  }

  /// Resolves true if the delegate had been replaced and was re-asserted.
  @objc(reassertDelegate:rejecter:)
  func reassertDelegate(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(PrayerAlarmCenter.shared.assertDelegate(reason: "js"))
  }
}
