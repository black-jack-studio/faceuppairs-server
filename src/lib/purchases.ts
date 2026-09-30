import Purchases, { type CustomerInfo, type PurchasesStoreProduct } from "react-native-purchases";
import { create } from "zustand";

import { REVENUECAT_API_KEY } from "@/config/env";
import { ICON_PACKS } from "@/game/iconPacks";
import { useWallet } from "@/store/wallet";

import { track } from "./analytics";

// Store products (same ids in App Store Connect, Google Play Console and RevenueCat).
// Prices always come from the store (priceString) — never written in the app, same rule as
// FaceUp's shop.
export const PRODUCT_IDS = {
  removeAds: "faceup_pairs.remove_ads",
  starterPack: "faceup_pairs.starter_pack",
  reviveOffer: "faceup_pairs.revive_offer",
  coins1: "faceup_pairs.coins_1000",
  coins2: "faceup_pairs.coins_3000",
  coins3: "faceup_pairs.coins_8000",
  coins4: "faceup_pairs.coins_20000",
  packSports: "faceup_pairs.pack_sports",
  plusMonthly: "faceup_pairs.plus_monthly",
  plusYearly: "faceup_pairs.plus_yearly",
} as const;

// RevenueCat entitlements granted by the non-consumables and subscriptions above.
const ENTITLEMENTS = { noAds: "no_ads", plus: "plus", packSports: "pack_sports" } as const;

/** What each consumable (or the one-time starter pack) puts in the wallet. */
export const CONTENTS: Record<string, { coins: number; peek?: number; hint?: number }> = {
  [PRODUCT_IDS.coins1]: { coins: 1_000 },
  [PRODUCT_IDS.coins2]: { coins: 3_000 },
  [PRODUCT_IDS.coins3]: { coins: 8_000 },
  [PRODUCT_IDS.coins4]: { coins: 20_000 },
  [PRODUCT_IDS.starterPack]: { coins: 1_000, peek: 3, hint: 3 },
  [PRODUCT_IDS.reviveOffer]: { coins: 500 },
};

export const COIN_PACK_IDS = [PRODUCT_IDS.coins1, PRODUCT_IDS.coins2, PRODUCT_IDS.coins3, PRODUCT_IDS.coins4];

interface StoreState {
  available: boolean;
  products: Record<string, { priceString: string; title: string }>;
}

export const useStore = create<StoreState>(() => ({ available: false, products: {} }));

const storeProducts = new Map<string, PurchasesStoreProduct>();
let configured = false;

function applyCustomerInfo(info: CustomerInfo) {
  const active = info.entitlements.active;
  const isPlus = Boolean(active[ENTITLEMENTS.plus]);
  const noAds = isPlus || Boolean(active[ENTITLEMENTS.noAds]);
  const wallet = useWallet.getState();
  wallet.setEntitlements({
    isPlus,
    adsRemoved: noAds,
    hasPurchased: wallet.hasPurchased || info.nonSubscriptionTransactions.length > 0 || info.activeSubscriptions.length > 0,
  });
  if (active[ENTITLEMENTS.packSports]) wallet.unlockPack("sports");
  // A pack reached through Pairs+ stays usable only while subscribed.
  if (!isPlus) {
    const plusPacks = ICON_PACKS.filter((p) => p.price.kind === "plus").map((p) => p.id);
    if (plusPacks.includes(wallet.activePack)) wallet.setActivePack("bar");
  }
}

export async function initPurchases(): Promise<void> {
  if (configured || !REVENUECAT_API_KEY) return;
  try {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    configured = true;
    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    applyCustomerInfo(await Purchases.getCustomerInfo());
    const products = await Purchases.getProducts(Object.values(PRODUCT_IDS));
    const subscriptions = await Purchases.getProducts(
      [PRODUCT_IDS.plusMonthly, PRODUCT_IDS.plusYearly],
      Purchases.PRODUCT_CATEGORY.SUBSCRIPTION,
    );
    const byId: StoreState["products"] = {};
    for (const product of [...products, ...subscriptions]) {
      storeProducts.set(product.identifier, product);
      byId[product.identifier] = { priceString: product.priceString, title: product.title };
    }
    useStore.setState({ available: storeProducts.size > 0, products: byId });
  } catch {
    useStore.setState({ available: false });
  }
}

export type PurchaseOutcome = "purchased" | "cancelled" | "failed" | "unavailable";

export async function buy(productId: string): Promise<PurchaseOutcome> {
  const product = storeProducts.get(productId);
  if (!product) return "unavailable";
  try {
    const { customerInfo } = await Purchases.purchaseStoreProduct(product);
    applyCustomerInfo(customerInfo);
    const wallet = useWallet.getState();
    const contents = CONTENTS[productId];
    const oneTime = productId === PRODUCT_IDS.starterPack;
    if (contents && !(oneTime && wallet.starterPackBought)) {
      wallet.addCoins(contents.coins);
      if (contents.peek) wallet.addBoosters("peek", contents.peek);
      if (contents.hint) wallet.addBoosters("hint", contents.hint);
    }
    wallet.setEntitlements({ hasPurchased: true, ...(oneTime ? { starterPackBought: true } : {}) });
    track("purchase", { product: productId, price: product.price, currency: product.currencyCode });
    return "purchased";
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? "cancelled" : "failed";
  }
}

/** "Restore purchases": non-consumables and subscriptions come back; coins never do. */
export async function restore(): Promise<"restored" | "none" | "failed"> {
  if (!configured) return "failed";
  try {
    const info = await Purchases.restorePurchases();
    applyCustomerInfo(info);
    const active = Object.keys(info.entitlements.active).length > 0;
    if (active && info.nonSubscriptionTransactions.some((t) => t.productIdentifier === PRODUCT_IDS.starterPack)) {
      useWallet.getState().setEntitlements({ starterPackBought: true });
    }
    return active ? "restored" : "none";
  } catch {
    return "failed";
  }
}

export async function manageSubscription(): Promise<void> {
  if (configured) await Purchases.showManageSubscriptions().catch(() => {});
}
