import PostHog from "posthog-react-native";

import { POSTHOG_HOST, POSTHOG_KEY } from "@/config/env";

// First-party product analytics (same tool as FaceUp). Never linked to ad data, never used for
// tracking across apps. Inert when no key is configured — every call below is then a no-op.
const client = POSTHOG_KEY ? new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST }) : null;

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
  | "ad_interstitial_shown";

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>) {
  client?.capture(event, properties);
}

/** Links events to the anonymous leaderboard account (the id, never the nickname). */
export function identify(playerId: string) {
  client?.identify(playerId);
}

export function resetAnalytics() {
  client?.reset();
}
