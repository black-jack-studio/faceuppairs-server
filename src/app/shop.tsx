import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { BOOSTER_PRICES, type BoosterId } from "@/game/economy";
import { ICON_PACKS, type IconPack } from "@/game/iconPacks";
import { track } from "@/lib/analytics";
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
import { Screen } from "@/ui/Screen";
import { colors } from "@/ui/theme";

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
    <Screen trailing={<CoinsPill />}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Shown even before the store answers, so the offer is always visible. */}
        <View style={styles.section}>
          <PlusOffer
            owned={wallet.isPlus}
            price={price(PRODUCT_IDS.plus) ?? DEV_PREVIEW_PLUS_PRICE}
            onBuy={() => purchase(PRODUCT_IDS.plus)}
          />
          {store.available && !wallet.starterPackBought && (
            <Item icon={UI_EMOJI.gift} title={t("shop.starter")} description={t("shop.starterDesc")}>
              <BuyButton price={price(PRODUCT_IDS.starterPack)} onPress={() => purchase(PRODUCT_IDS.starterPack)} />
            </Item>
          )}
        </View>

        {store.available && (
          <Section title={t("shop.coins")}>
            {COIN_PACK_IDS.map((id, i) => (
              <Item
                key={id}
                icon={
                  i < 2
                    ? UI_EMOJI.coin
                    : i === 2
                      ? UI_EMOJI.moneybag
                      : UI_EMOJI.gem
                }
                title={formatScore(CONTENTS[id].coins, i18n.language)}
              >
                <BuyButton price={price(id)} onPress={() => purchase(id)} />
              </Item>
            ))}
          </Section>
        )}

        <Section title={t("shop.boosters")}>
          {(["peek", "hint"] as const).map((id) => (
            <Item
              key={id}
              icon={id === "peek" ? UI_EMOJI.crystalball : UI_EMOJI.lightbulb}
              title={`${t(`boosters.${id}`)} · ${wallet.boosters[id]}`}
            >
              <AppButton
                label={t("shop.buyWithCoins", { price: BOOSTER_PRICES[id] })}
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

        <View style={styles.footer}>
          {store.available && (
            <>
              <AppButton label={t("shop.restore")} onPress={onRestore} />
            </>
          )}
          <View style={styles.links}>
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() =>
                router.push({
                  pathname: "/legal/[doc]",
                  params: { doc: "terms" },
                })
              }
            >
              {t("shop.terms")}
            </Text>
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() =>
                router.push({
                  pathname: "/legal/[doc]",
                  params: { doc: "privacy" },
                })
              }
            >
              {t("shop.privacy")}
            </Text>
          </View>
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

function Item({
  icon,
  title,
  description,
  children,
}: {
  icon?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.item}>
      {icon ? <Emoji asset={icon} size={36} /> : null}
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

  const unlockWithCoins = (amount: number) => {
    const wallet = useWallet.getState();
    if (!wallet.spendCoins(amount)) {
      Alert.alert(
        t("boosters.notEnough"),
        t("boosters.notEnoughBody", { price: amount }),
      );
      return;
    }
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
        onPress={() => unlockWithCoins(amount)}
      />
    );
  } else if (pack.price.kind === "iap") {
    const productId = pack.price.productId;
    action = <BuyButton price={price} onPress={() => onBuyIap(productId)} />;
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
  content: {
    paddingTop: 16,
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
  item: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
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
  links: {
    flexDirection: "row",
    gap: 20,
  },
  link: {
    color: colors.muted,
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
