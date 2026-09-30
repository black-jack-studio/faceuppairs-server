import * as Notifications from "expo-notifications";
import type { TFunction } from "i18next";

// Local notifications only (no server push): "your chest is ready" the next morning and
// "your streak is waiting" the next evening. Rescheduled every time the chest is claimed, so a
// player who comes back early never gets a stale reminder.

const CHEST_HOUR = 10;
const STREAK_HOUR = 20;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function notificationStatus(): Promise<"granted" | "denied" | "undetermined"> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestNotifications(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

function tomorrowAt(hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export async function scheduleReminders(t: TFunction): Promise<void> {
  if ((await notificationStatus()) !== "granted") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: t("notifications.chestTitle"), body: t("notifications.chestBody") },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrowAt(CHEST_HOUR) },
  });
  await Notifications.scheduleNotificationAsync({
    content: { title: t("notifications.streakTitle"), body: t("notifications.streakBody") },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrowAt(STREAK_HOUR) },
  });
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
