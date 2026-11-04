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
/// was killed and without booting JS.
final class PrayerAlarmCenter: NSObject, UNUserNotificationCenterDelegate {
  static let shared = PrayerAlarmCenter()

  private var installed = false

  /// Call from `application(_:didFinishLaunchingWithOptions:)`, before JS starts:
  /// the delegate must exist before launch finishes or action buttons are not
  /// delivered when the app was killed.
  func install() {
    guard !installed else { return }
    installed = true
    UNUserNotificationCenter.current().delegate = self
    registerCategories()
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
    snoozeCount: Int,
    plain: Bool = false
  ) -> UNMutableNotificationContent {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = makeSound(sound)
    content.threadIdentifier = kThreadId
    if plain {
      // A reminder, not an alarm: no Snooze/Stop buttons, not time sensitive.
      content.interruptionLevel = .active
    } else {
      content.interruptionLevel = .timeSensitive
      let canSnooze = snoozeMinutes > 0 && (maxSnooze == 0 || snoozeCount < maxSnooze)
      content.categoryIdentifier = canSnooze ? snoozeCategoryId(snoozeMinutes) : kNoSnoozeCategory
    }
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
    // Alarms must show and sound even while the app is open.
    completionHandler([.banner, .list, .sound])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let notification = response.notification
    guard isOurs(notification.request.content.userInfo) else {
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
      snoozeCount: (item["snoozeCount"] as? NSNumber)?.intValue ?? 0,
      plain: (item["plain"] as? NSNumber)?.boolValue ?? false
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

  /// Cancels pending requests that were NOT scheduled by this module: the
  /// alarms the Notifee-based versions of the app left behind. Without this
  /// they would ring next to the new ones after an update.
  @objc(cancelLegacy:rejecter:)
  func cancelLegacy(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { requests in
      let ids = requests
        .filter { !isOurs($0.content.userInfo) }
        .map { $0.identifier }
      center.removePendingNotificationRequests(withIdentifiers: ids)
      resolve(ids.count)
    }
  }

  /// Removes every notification of this app from the notification centre.
  @objc(clearDelivered:rejecter:)
  func clearDelivered(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    resolve(true)
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
}
