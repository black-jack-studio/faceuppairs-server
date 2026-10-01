import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView } from "react-native";

import { deleteAccount } from "@/lib/account";
import { resetAnalytics } from "@/lib/analytics";
import { clearQueuedRuns } from "@/lib/runQueue";
import { useProgress } from "@/store/progress";
import { useSettings } from "@/store/settings";
import { useWallet } from "@/store/wallet";
import { ListRow } from "@/ui/ListRow";
import { Screen } from "@/ui/Screen";

type Doc = "privacy" | "notice" | "terms" | "support";

export default function Privacy() {
  const { t } = useTranslation("settings");
  const hiddenCount = useProgress((s) => s.hiddenRefs.length);

  const open = (doc: Doc) => router.push({ pathname: "/legal/[doc]", params: { doc } });

  // Apple 5.1.1(v) / Google Play: deletion reachable from inside the app. Wipes the device and
  // deletes the leaderboard account on the server (queued if offline, see account.ts).
  const confirmDelete = () => {
    Alert.alert(t("deleteDataTitle"), t("deleteDataBody"), [
      { text: t("common:cancel"), style: "cancel" },
      {
        text: t("deleteDataConfirm"),
        style: "destructive",
        onPress: async () => {
          await deleteAccount();
          resetAnalytics();
          await clearQueuedRuns();
          useProgress.getState().reset();
          useSettings.getState().reset();
          useWallet.getState().reset();
          router.dismissAll();
          Alert.alert(t("deleteDataDone"));
        },
      },
    ]);
  };

  // Blocking has to be reversible and visible (FaceUp added its Blocked Players list for the
  // same reason): hidden players can all be shown again from here.
  const confirmUnhide = () => {
    Alert.alert(t("unhideTitle"), undefined, [
      { text: t("common:cancel"), style: "cancel" },
      { text: t("unhideConfirm"), onPress: () => useProgress.getState().unhideAll() },
    ]);
  };

  return (
    <Screen title={t("privacyTitle")}>
      <ScrollView>
        <ListRow label={t("privacyPolicy")} onPress={() => open("privacy")} />
        <ListRow label={t("legalNotice")} onPress={() => open("notice")} />
        <ListRow label={t("termsOfService")} onPress={() => open("terms")} />
        <ListRow label={t("support")} onPress={() => open("support")} />
        {hiddenCount > 0 && (
          <ListRow
            label={t("hiddenPlayers")}
            value={t("hiddenPlayersValue", { count: hiddenCount })}
            onPress={confirmUnhide}
          />
        )}
        <ListRow label={t("deleteData")} destructive onPress={confirmDelete} />
      </ScrollView>
    </Screen>
  );
}
