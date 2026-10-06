import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { BOOSTER_PRICES, FREE_COINS_PER_DAY, FREE_COINS_REWARD, localDay, type BoosterId } from "@/game/economy";
import { ICON_PACKS, type IconPack } from "@/game/iconPacks";
import { showRewarded, useAds } from "@/lib/ads";
import { track } from "@/lib/analytics";
import { appIconsSupported } from "@/lib/appIcons";
import { formatScore } from "@/lib/format";
import { hapticSuccess, hapticTick } from "@/lib/haptics";
import {
  buy,
  COIN_PACK_IDS,
  CONTENTS,
  PRODUCT_IDS,
  restore,
  useStore,
} from "@/lib/purchases";
import { useWallet } from "@/store/wallet";
import { AppButton } from "@/ui/AppButton";
import { CoinsPill } from "@/ui/CoinsPill";
import { Emoji, UI_EMOJI } from "@/ui/Emoji";
import { Screen, useHeaderInset } from "@/ui/Screen";
import { colors, space } from "@/ui/theme";

// Same width for every button of the boosters list, so their edges line up.
const BOOSTER_BUTTON_WIDTH = 84;

// Development only: the store has no products yet, show the Pairs+ button anyway to judge the
// layout. Release builds always show the store's own price (or "unavailable").
const DEV_PREVIEW_PLUS_PRICE = __DEV__ ? "3,99 €" : undefined;

// One icon from different groups of the pack, so the preview shows its range.
const PREVIEW_SLOTS = [5, 0, 8, 20];

export default function Shop() {
  const { t, i18n } = useTranslation();
  const store = useStore();
  const wallet = useWallet();
  const price = (id: string) => store.products[id]?.priceString;

  const purchase = async (productId: string) => {
    const outcome = await buy(productId);
    if (outcome === "purchased") {
      hapticSuccess();
      Alert.alert(t("shop.purchased"));
    } else if (outcome === "failed" || outcome === "unavailable") {
      Alert.alert(t("shop.failed"));
    }
  };

  const buyBooster = (id: BoosterId) => {
    if (useWallet.getState().spendCoins(BOOSTER_PRICES[id])) {
      useWallet.getState().addBoosters(id, 1);
      hapticSuccess();
    } else {
      Alert.alert(
        t("boosters.notEnough"),
        t("boosters.notEnoughBody", { price: BOOSTER_PRICES[id] }),
      );
    }
  };

  const headerInset = useHeaderInset();
  const rewardedReady = useAds((s) => s.rewardedReady);
  const today = localDay();
  const freeCoinsLeft = FREE_COINS_PER_DAY - (wallet.freeCoins.day === today ? wallet.freeCoins.count : 0);
  const watchForCoins = async () => {
    if (await showRewarded("free_coins")) {
      if (useWallet.getState().claimFreeCoins(localDay())) hapticSuccess();
    }
  };

  const onRestore = async () => {
    const result = await restore();
    Alert.alert(
      result === "restored"
        ? t("settings:restoreDone")
        : result === "none"
          ? t("settings:restoreNone")
          : t("settings:restoreFailed"),
    );
  };

  return (
    <Screen trailing={<CoinsPill />} overlayHeader>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Shown even before the store answers, so the offer is always visible. Runs edge to edge
            and up under the header, so the top of the screen reads as one black panel. */}
        <View style={[styles.plusPanel, { paddingTop: headerInset + 8 }]}>
          <View style={styles.plusOverscroll} />
          <PlusOffer
            owned={wallet.isPlus}
            price={price(PRODUCT_IDS.plus) ?? DEV_PREVIEW_PLUS_PRICE}
            onBuy={() => purchase(PRODUCT_IDS.plus)}
          />
        </View>

        <Section title={t("shop.boosters")}>
          <Item
            icon={UI_EMOJI.coin}
            title={t("shop.freeCoins", { coins: FREE_COINS_REWARD })}
            description={t("shop.freeCoinsLeft", { left: freeCoinsLeft, max: FREE_COINS_PER_DAY })}
          >
            {freeCoinsLeft > 0 ? (
              <AppButton label={t("shop.watchAd")} width={BOOSTER_BUTTON_WIDTH} disabled={!rewardedReady} onPress={watchForCoins} />
            ) : (
              <Text style={styles.packState}>{t("shop.freeCoinsDone")}</Text>
            )}
          </Item>
          {(["peek", "hint"] as const).map((id) => (
            <Item
              key={id}
              icon={id === "peek" ? UI_EMOJI.crystalball : UI_EMOJI.lightbulb}
              title={`${t(`boosters.${id}`)} · ${wallet.boosters[id]}`}
            >
              <AppButton
                label={t("shop.buyWithCoins", { price: BOOSTER_PRICES[id] })}
                width={BOOSTER_BUTTON_WIDTH}
                onPress={() => buyBooster(id)}
              />
            </Item>
          ))}
        </Section>

        <Section title={t("shop.icons")}>
          <View style={styles.packs}>
            {ICON_PACKS.map((pack) => (
              <PackTile
                key={pack.id}
                pack={pack}
                onBuyIap={purchase}
                price={
                  pack.price.kind === "iap"
                    ? price(pack.price.productId)
                    : undefined
                }
              />
            ))}
          </View>
        </Section>

        {store.available && (
          <Section title={t("shop.coins")}>
            {COIN_PACK_IDS.map((id, i) => (
              <Item
                key={id}
                iconNode={<Emoji asset={COIN_PACK_ART[i]} size={COIN_PACK_ART_SIZE} />}
                title={formatScore(CONTENTS[id].coins, i18n.language)}
              >
                <BuyButton price={price(id)} onPress={() => purchase(id)} />
              </Item>
            ))}
          </Section>
        )}

        {appIconsSupported && (
          <Section title={t("appIcons.title")}>
            <Item title={t("appIcons.shopTeaser")} last>
              <AppButton label={t("appIcons.see")} onPress={() => router.push("/app-icon")} />
            </Item>
          </Section>
        )}

        <View style={styles.footer}>
          {store.available && (
            <>
              <AppButton label={t("shop.restore")} onPress={onRestore} />
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

// Coin pack illustrations, smallest to biggest: a few coins, a pile, a bag, a chest.
const COIN_PACK_ART = ["coin_pile_small", "coin_pile_large", "coin_bag", "coin_chest"] as const;
// Also the width of every shop row's icon column, so all texts line up.
const COIN_PACK_ART_SIZE = 56;

function Item({
  icon,
  iconNode,
  title,
  description,
  last,
  children,
}: {
  icon?: string;
  /** Drawn instead of `icon` (the coin piles). */
  iconNode?: ReactNode;
  title: string;
  description?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.item, last && styles.itemLast]}>
      {(iconNode || icon) && (
        // One icon column for every row (as wide as the biggest coin pile), so all texts line up.
        <View style={styles.itemIcon}>{iconNode ?? <Emoji asset={icon as string} size={36} />}</View>
      )}
      <View style={styles.itemText}>
        <Text style={styles.itemTitle}>{title}</Text>
        {description ? (
          <Text style={styles.itemDesc}>{description}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// The one offer that matters most: what you get, at a glance, and one centered button.
const PLUS_PERKS = [
  { icon: "prohibited", label: "shop.plusNoAds" },
  { icon: "smiling_face_with_sunglasses", label: "shop.plusFaces" },
  { icon: UI_EMOJI.crown, label: "shop.plusCrown" },
] as const;

function PlusOffer({ owned, price, onBuy }: { owned: boolean; price?: string; onBuy: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.plus}>
      <View style={styles.plusHeader}>
        <Text style={styles.plusTitle} accessibilityRole="header">
          {t("shop.plus")}
        </Text>
        <Text style={styles.plusTagline}>{owned ? t("shop.plusActive") : t("shop.plusTagline")}</Text>
      </View>
      <View style={styles.plusPerks}>
        {PLUS_PERKS.map((perk) => (
          <View key={perk.label} style={styles.plusPerk}>
            <Emoji asset={perk.icon} size={40} />
            <Text style={styles.plusPerkLabel}>{t(perk.label)}</Text>
          </View>
        ))}
      </View>
      {!owned && <BuyButton primary price={price} onPress={onBuy} />}
    </View>
  );
}

// No price means the store couldn't load this product: say so instead of a dead button.
function BuyButton({
  price,
  onPress,
  primary = false,
}: {
  price?: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { t } = useTranslation();
  if (!price) return <Text style={styles.packState}>{t("shop.notSold")}</Text>;
  return <AppButton label={price} variant={primary ? "primary" : "secondary"} onPress={onPress} />;
}

function PackTile({
  pack,
  price,
  onBuyIap,
}: {
  pack: IconPack;
  price?: string;
  onBuyIap: (id: string) => void;
}) {
  const { t } = useTranslation();
  const owned = useWallet((s) => s.ownedPacks.includes(pack.id));
  const active = useWallet((s) => s.activePack === pack.id);
  const isPlus = useWallet((s) => s.isPlus);
  const usable =
    owned ||
    pack.price.kind === "free" ||
    (pack.price.kind === "plus" && isPlus);

  const notEnough = (amount: number) =>
    Alert.alert(t("boosters.notEnough"), t("boosters.notEnoughBody", { price: amount }));

  // Coins leave the wallet on a single tap, so ask first (store purchases have Apple's own sheet).
  const confirmUnlock = (amount: number) => {
    if (useWallet.getState().coins < amount) return notEnough(amount);
    Alert.alert(
      t("shop.confirmBuyTitle", { name: t(`shop.packNames.${pack.id}`) }),
      t("shop.confirmBuyBody", { price: amount }),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("shop.confirmBuyYes"), style: "default", isPreferred: true, onPress: () => unlockWithCoins(amount) },
      ],
    );
  };

  const unlockWithCoins = (amount: number) => {
    const wallet = useWallet.getState();
    if (!wallet.spendCoins(amount)) return notEnough(amount);
    wallet.unlockPack(pack.id);
    wallet.setActivePack(pack.id);
    track("pack_unlocked", { pack: pack.id, via: "coins" });
    hapticSuccess();
  };

  let action: ReactNode;
  if (active)
    action = <Text style={styles.packState}>{t("shop.equipped")}</Text>;
  else if (usable)
    action = (
      <AppButton
        label={t("shop.equip")}
        variant="primary"
        onPress={() => {
          hapticTick();
          useWallet.getState().setActivePack(pack.id);
        }}
      />
    );
  else if (pack.price.kind === "coins") {
    const amount = pack.price.amount;
    action = (
      <AppButton
        label={t("shop.buyWithCoins", { price: amount })}
        onPress={() => confirmUnlock(amount)}
      />
    );
  } else if (pack.price.kind === "iap") {
    const productId = pack.price.productId;
    action = <BuyButton price={price} onPress={() => onBuyIap(productId)} />;
  } else if (pack.price.kind === "level") {
    action = <Text style={styles.packState}>{t("shop.levelReward", { n: pack.price.level })}</Text>;
  } else action = <Text style={styles.packState}>{t("shop.plusOnly")}</Text>;

  return (
    <View style={styles.pack}>
      <View style={styles.packPreview} accessible={false}>
        {PREVIEW_SLOTS.map((slot) => (
          <View key={slot} style={styles.packCard}>
            <Emoji asset={pack.icons[slot].asset} size={30} />
          </View>
        ))}
      </View>
      <Text style={styles.itemTitle}>{t(`shop.packNames.${pack.id}`)}</Text>
      <View style={styles.packAction}>{action}</View>
    </View>
  );
}

// Fixed slot under each pack: a button appearing or turning into "Equipped" animates inside
// it instead of changing the tile's height and pushing the grid around.
const PACK_ACTION_HEIGHT = 52;

const styles = StyleSheet.create({
  // Spans the full width (the Screen gutter is cancelled) so the Pairs+ panel can reach both edges.
  scroll: {
    marginHorizontal: -space.screen,
  },
  content: {
    paddingHorizontal: space.screen,
    paddingBottom: 40,
    gap: 28,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  itemIcon: {
    width: COIN_PACK_ART_SIZE,
    alignItems: "flex-start",
  },
  item: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemText: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  itemDesc: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  plusPanel: {
    marginHorizontal: -space.screen,
    paddingHorizontal: space.screen,
    paddingBottom: 28,
    backgroundColor: colors.card,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  // Pulling down past the top shows more black, never the grey board.
  plusOverscroll: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    height: 1000,
    backgroundColor: colors.card,
  },
  plus: {
    alignItems: "center",
    gap: 20,
    paddingVertical: 8,
  },
  plusHeader: {
    alignItems: "center",
    gap: 4,
  },
  plusTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
  },
  plusTagline: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "500",
  },
  plusPerks: {
    flexDirection: "row",
    alignSelf: "stretch",
  },
  plusPerk: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  plusPerkLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  packs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  pack: {
    width: "46%",
    flexGrow: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  packPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 92,
    gap: 4,
  },
  packCard: {
    width: 44,
    height: 44,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  packAction: {
    height: PACK_ACTION_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  packState: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    minHeight: 44,
    textAlignVertical: "center",
    lineHeight: 44,
  },
  footer: {
    alignItems: "center",
    gap: 12,
  },
});
