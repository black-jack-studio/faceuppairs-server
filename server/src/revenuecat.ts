// Asks RevenueCat whether a player owns Pairs+. The app logs in to RevenueCat with its player
// id, so the RevenueCat customer id is the player id.
const ENTITLEMENT = "plus";

export type PlusChecker = (playerId: string) => Promise<boolean>;

export function revenueCatPlusChecker(secretKey: string): PlusChecker {
  return async (playerId) => {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(playerId)}`, {
      headers: { authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) throw new Error(`revenuecat_${res.status}`);
    const body = (await res.json()) as {
      subscriber?: { entitlements?: Record<string, { expires_date: string | null }> };
    };
    const entitlement = body.subscriber?.entitlements?.[ENTITLEMENT];
    // A one-time purchase never expires; a refund removes the entitlement altogether.
    return Boolean(entitlement) && (entitlement!.expires_date === null || new Date(entitlement!.expires_date) > new Date());
  };
}
