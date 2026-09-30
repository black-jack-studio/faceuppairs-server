import { router } from "expo-router";
import type { TFunction } from "i18next";
import { Alert, Platform } from "react-native";

import { saveNickname } from "./nickname";

// Presenting a new alert while the previous one is still animating out is dropped by iOS.
const REPROMPT_DELAY_MS = 350;

/**
 * Asks for a nickname with the native iOS text-field alert. An invalid or taken name re-opens
 * the alert with the reason. "Later" is always offered: the game is fully playable without a
 * nickname. Android has no native text alert, so it opens the nickname sheet instead.
 */
export function promptNickname(t: TFunction, reason?: string) {
  if (Platform.OS !== "ios") {
    router.push("/settings/username");
    return;
  }

  const ask = (message: string, defaultValue = "") => {
    Alert.prompt(
      t("settings:username.title"),
      message,
      [
        { text: t("settings:username.later"), style: "cancel" },
        {
          text: t("settings:username.save"),
          isPreferred: true,
          onPress: (value?: string) => {
            const name = (value ?? "").trim();
            saveNickname(name).then((result) => {
              if (result.ok) return;
              setTimeout(
                () => ask(t(`settings:username.errors.${result.error}`, { days: result.days ?? 7 }), name),
                REPROMPT_DELAY_MS,
              );
            });
          },
        },
      ],
      "plain-text",
      defaultValue,
    );
  };

  ask(reason ?? `${t("settings:username.subtitle")}\n${t("settings:username.rules")}`);
}
