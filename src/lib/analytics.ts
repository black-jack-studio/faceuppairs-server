import PostHog from "posthog-react-native";

import { POSTHOG_HOST, POSTHOG_KEY } from "@/config/env";

// First-party product analytics (same tool as FaceUp). Never linked to ad data, never used for
// tracking across apps. Inert when no key is configured — every call below is then a no-op.
// Starts opted out: nothing is sent until setAnalyticsEnabled(true), which the root layout calls
// once the consent rules allow it (see analyticsAllowed in store/settings.ts).
const client = POSTHOG_KEY ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, defaultOptIn: false }) : null;

export const analyticsAvailable = client !== null;

let playerId: string | null = null;

export type AnalyticsEvent =
  | "level_complete"
  | "run_finished"
  | "daily_finished"
  | "revive"
  | "booster_used"
  | "chest_claimed"
  | "pack_unlocked"
  | "purchase"
  | "ad_rewarded_shown"
  | "ad_rewarded_earned"
  | "ad_interstitial_shown"
  | "secret_board_opened"
  | "secret_board_complete";

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>) {
  client?.capture(event, properties);
}

/** Links events to the anonymous leaderboard account (the id, never the nickname). */
export function identify(id: string) {
  playerId = id;
  if (client && !client.optedOut) client.identify(id);
}

export async function setAnalyticsEnabled(enabled: boolean) {
  if (!client || enabled === !client.optedOut) return;
  if (enabled) {
    await client.optIn();
    if (playerId) client.identify(playerId);
  } else {
    await client.optOut();
  }
}

/** "Delete my data": forgets the identity on this device; the next one starts anonymous. */
export function resetAnalytics() {
  playerId = null;
  client?.reset();
}
