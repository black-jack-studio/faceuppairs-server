import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { BOOSTER_PRICES, type BoosterId } from "@/game/economy";
import { ICON_PACKS, type IconPack } from "@/game/iconPacks";
import { track } from "@/lib/analytics";
import { formatScore } from "@/lib/format";
import { hapticSuccess } from "@/lib/haptics";
import {
  buy,
  COIN_PACK_IDS,
  CONTENTS,
  manageSubscription,
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
    <Screen title={t("shop.title")} trailing={<CoinsPill />}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!store.available && (
          <Text style={styles.notice}>{t("shop.unavailable")}</Text>
        )}

        {(store.available || wallet.isPlus) && (
          <Section title={t("shop.offers")}>
            {wallet.isPlus ? (
              <Item
                icon={UI_EMOJI.crown}
                title={t("shop.plusActive")}
                description={t("shop.plusDesc")}
              >
                <AppButton
                  label={t("settings:manageSubscription")}
                  onPress={manageSubscription}
                />
              </Item>
            ) : (
              <Item
                icon={UI_EMOJI.crown}
                title={t("shop.plus")}
                description={t("shop.plusDesc")}
              >
                <View style={styles.stack}>
                  <AppButton
                    label={
                      price(PRODUCT_IDS.plusYearly)
                        ? t("shop.plusYearly", {
                            price: price(PRODUCT_IDS.plusYearly),
                          })
                        : "—"
                    }
                    variant="primary"
                    disabled={!price(PRODUCT_IDS.plusYearly)}
                    onPress={() => purchase(PRODUCT_IDS.plusYearly)}
                  />
                  <AppButton
                    label={
                      price(PRODUCT_IDS.plusMonthly)
                        ? t("shop.plusMonthly", {
                            price: price(PRODUCT_IDS.plusMonthly),
                          })
                        : "—"
                    }
                    disabled={!price(PRODUCT_IDS.plusMonthly)}
                    onPress={() => purchase(PRODUCT_IDS.plusMonthly)}
                  />
                </View>
              </Item>
            )}
            {!wallet.starterPackBought && (
              <Item
                icon={UI_EMOJI.gift}
                title={t("shop.starter")}
                description={t("shop.starterDesc")}
              >
                <BuyButton
                  price={price(PRODUCT_IDS.starterPack)}
                  onPress={() => purchase(PRODUCT_IDS.starterPack)}
                />
              </Item>
            )}
            {!wallet.adsRemoved && (
              <Item
                icon={UI_EMOJI.sparkles}
                title={t("shop.removeAds")}
                description={t("shop.removeAdsDesc")}
              >
                <BuyButton
                  price={price(PRODUCT_IDS.removeAds)}
                  onPress={() => purchase(PRODUCT_IDS.removeAds)}
                />
              </Item>
            )}
          </Section>
        )}

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
              <Text style={styles.terms}>{t("shop.subscriptionTerms")}</Text>
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

// No price means the store couldn't load this product: say so instead of a dead button.
function BuyButton({
  price,
  onPress,
}: {
  price?: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  if (!price) return <Text style={styles.packState}>{t("shop.notSold")}</Text>;
  return <AppButton label={price} onPress={onPress} />;
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
        onPress={() => useWallet.getState().setActivePack(pack.id)}
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
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
    gap: 28,
  },
  notice: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
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
  stack: {
    gap: 8,
    alignItems: "flex-end",
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
  terms: {
    color: colors.faint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
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
