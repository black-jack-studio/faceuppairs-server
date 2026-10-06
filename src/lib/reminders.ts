import * as Notifications from "expo-notifications";
import type { TFunction } from "i18next";

import { useSettings } from "@/store/settings";

import { nextUtcMidnight } from "./format";

// Local notifications only (no server push), all counted from the last time the app was opened:
// tomorrow morning "your reward (and the daily challenge) is ready", tomorrow evening "your streak
// is waiting", then one nudge after 3 days away and a last one after a week. Rescheduled on every
// open, so a player who comes back never gets a stale reminder and one who left gets 4 at most.

const MORNING_HOUR = 10;
const STREAK_HOUR = 20;
const COMEBACK_HOUR = 19;
const COMEBACK_DAYS = [3, 7] as const;
const DAILY_EARLIEST_HOUR = 9;
const DAILY_LATEST_HOUR = 22;

/** When the next daily challenge opens (UTC midnight), nudged into waking hours in local time. */
function nextDailyReminder(): Date {
  const date = nextUtcMidnight();
  if (date.getHours() < DAILY_EARLIEST_HOUR) date.setHours(DAILY_EARLIEST_HOUR, 0, 0, 0);
  else if (date.getHours() >= DAILY_LATEST_HOUR) {
    date.setDate(date.getDate() + 1);
    date.setHours(DAILY_EARLIEST_HOUR, 0, 0, 0);
  }
  return date;
}

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

function inDaysAt(days: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export async function scheduleReminders(t: TFunction): Promise<void> {
  if ((await notificationStatus()) !== "granted") return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const morning = inDaysAt(1, MORNING_HOUR);
  const daily = nextDailyReminder();
  // In Europe the challenge is already live by morning: one notification for both instead of two
  // an hour apart. Further west it opens later in the day, so it keeps its own.
  const reminders: { date: Date; title: string; body: string }[] =
    daily <= morning
      ? [{ date: morning, title: t("notifications.morningTitle"), body: t("notifications.morningBody") }]
      : [
          { date: morning, title: t("notifications.chestTitle"), body: t("notifications.chestBody") },
          { date: daily, title: t("notifications.dailyTitle"), body: t("notifications.dailyBody") },
        ];
  reminders.push({ date: inDaysAt(1, STREAK_HOUR), title: t("notifications.streakTitle"), body: t("notifications.streakBody") });
  for (const days of COMEBACK_DAYS) {
    reminders.push({
      date: inDaysAt(days, COMEBACK_HOUR),
      title: t(`notifications.comeback${days}Title`),
      body: t(`notifications.comeback${days}Body`),
    });
  }

  // Each one puts the icon's red badge at the number of reminders delivered so far (1, 2, 3...),
  // which is exact because opening the app clears the badge and reschedules everything.
  reminders.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const [i, { date, title, body }] of reminders.entries()) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, badge: i + 1 },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

/** The player is back: clear the badge and the reminders already shown, and count again from now. */
export async function onAppOpened(t: TFunction): Promise<void> {
  await Notifications.setBadgeCountAsync(0).catch(() => false);
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
  if (useSettings.getState().reminders) await scheduleReminders(t);
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.setBadgeCountAsync(0).catch(() => false);
}
