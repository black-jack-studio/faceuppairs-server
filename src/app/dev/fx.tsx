import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { allSecretPairs } from "@/fx/secretPairs";
import { playFx, type Fx } from "@/fx/store";
import { getPack } from "@/game/iconPacks";
import { useWallet } from "@/store/wallet";
import { AppButton } from "@/ui/AppButton";
import { CreditsReveal } from "@/ui/CreditsReveal";
import { Emoji } from "@/ui/Emoji";
import { Screen } from "@/ui/Screen";
import { colors } from "@/ui/theme";

// Development only: replay every effect to judge it. `?play=perfect` or `?play=<packId>`
// starts one on open (handy from a deep link); change `n` to replay the same one.
export default function DevFx() {
  const { play, n } = useLocalSearchParams<{ play?: string; n?: string }>();
  const perfect = (): Fx => ({ kind: "perfect", emojis: getPack(useWallet.getState().activePack).icons.map((i) => i.asset) });
  const secrets = allSecretPairs();
  const [credits, setCredits] = useState(play === "credits");

  useEffect(() => {
    if (!__DEV__ || !play) return;
    const fx = play === "perfect" ? perfect() : secrets.find((s) => s.packId === play)?.fx;
    if (fx) setTimeout(() => playFx(fx), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, n]);

  if (!__DEV__) return <Redirect href="/" />;
  return (
    <Screen title="Effets">
      <ScrollView contentContainerStyle={styles.list}>
        <AppButton label="Partie parfaite" variant="primary" onPress={() => playFx(perfect())} />
        <AppButton label="Crédits (7 taps sur la version)" onPress={() => setCredits(true)} />
        <Text style={styles.caption}>Paires secrètes</Text>
        {secrets.map((s) => (
          <AppButton key={s.packId} label={`${s.packId}`} onPress={() => playFx(s.fx)} />
        ))}
        <Text style={styles.caption}>Fêtes sur l’accueil</Text>
        {(["halloween", "christmas", "newYear", "valentine"] as const).map((season) => (
          <AppButton key={season} label={season} onPress={() => router.navigate({ pathname: "/", params: { season } })} />
        ))}
        <Text style={styles.caption}>
          Paires secrètes : {secrets.map((s) => (
            <Emoji key={s.packId} asset={s.asset} size={14} />
          ))}
        </Text>
      </ScrollView>
      <CreditsReveal visible={credits} onClose={() => setCredits(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    alignItems: "center",
    paddingVertical: 16,
  },
  caption: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 8,
  },
});
