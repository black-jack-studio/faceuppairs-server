import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionSheetIOS, ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ensureAccount, getCredentials } from "@/lib/account";
import { api, type BoardKind, type Leaderboard, type LeaderboardEntry } from "@/lib/api";
import { formatCountdown, formatScore } from "@/lib/format";
import { hapticTick } from "@/lib/haptics";
import { promptNickname } from "@/lib/promptNickname";
import { useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";
import { AppButton } from "@/ui/AppButton";
import { Emoji, MEDALS, UI_EMOJI } from "@/ui/Emoji";
import { Screen } from "@/ui/Screen";
import { fakeLeaderboard, SCREENSHOT_MODE } from "@/lib/screenshotMode"; // TEMP
import { Segmented } from "@/ui/Segmented";
import { colors, space } from "@/ui/theme";

const BOARDS: BoardKind[] = ["endless", "daily"];
// Fixed row height, so the list can jump straight to the player's row.
const ROW_HEIGHT = 56;

export default function LeaderboardScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ board?: string }>();
  const [kind, setKind] = useState<BoardKind>(BOARDS.includes(params.board as BoardKind) ? (params.board as BoardKind) : "endless");
  const [data, setData] = useState<Leaderboard | null>(null);
  const isPlus = useWallet((s) => s.isPlus);
  const [status, setStatus] = useState<"loading" | "ready" | "offline">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const hiddenRefs = useProgress((s) => s.hiddenRefs);
  const nickname = useProgress((s) => s.nickname);
  const listRef = useRef<FlatList<LeaderboardEntry>>(null);

  const load = useCallback(
    async (board: BoardKind) => {
      if (SCREENSHOT_MODE) {
        setData(fakeLeaderboard(board));
        setStatus("ready");
        return;
      }
      const credentials = (await getCredentials()) ?? (await ensureAccount());
      const res = await api.leaderboard(board, credentials);
      if (res.ok) {
        setData(res.data);
        setStatus("ready");
      } else {
        setStatus("offline");
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      setStatus((s) => (s === "ready" ? s : "loading"));
      load(kind);
    }, [kind, load]),
  );

  const onChange = (board: BoardKind) => {
    hapticTick();
    setKind(board);
    setData(null);
    setStatus("loading");
  };

  // Apple 1.2: every public name can be reported and hidden, one tap away.
  const openActions = (entry: LeaderboardEntry) => {
    if (entry.isMe) return;
    const report = async () => {
      const credentials = await ensureAccount();
      const res = credentials ? await api.report(credentials, entry.ref) : null;
      Alert.alert(res?.ok ? t("leaderboard.reported") : t("leaderboard.reportFailed"));
    };
    const hide = () => useProgress.getState().hidePlayer(entry.ref);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: entry.name,
          options: [t("leaderboard.report"), t("leaderboard.hide"), t("cancel")],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) report();
          if (index === 1) hide();
        },
      );
    } else {
      Alert.alert(entry.name, undefined, [
        { text: t("leaderboard.report"), style: "destructive", onPress: report },
        { text: t("leaderboard.hide"), onPress: hide },
        { text: t("cancel"), style: "cancel" },
      ]);
    }
  };

  const entries = (data?.entries ?? []).filter((e) => e.isMe || !hiddenRefs.includes(e.ref));

  // Only the top 100 are loaded: a player ranked beyond that gets their own row after the list.
  const myIndex = entries.findIndex((e) => e.isMe);
  const meBeyondList = Boolean(data?.me) && myIndex < 0 && entries.length > 0;
  const scrollToMe = () => {
    hapticTick();
    if (myIndex >= 0) listRef.current?.scrollToIndex({ index: myIndex, viewPosition: 0.4, animated: true });
    else listRef.current?.scrollToEnd({ animated: true });
  };

  const meta = data
    ? [
        data.total > 0 ? t("leaderboard.players", { count: data.total }) : null,
        data.endsAt ? t("leaderboard.endsIn", { time: formatCountdown(data.endsAt, i18n.language) }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Screen title={t("leaderboard.title")}>
      <Segmented
        stretch
        accessibilityLabel={t("leaderboard.title")}
        value={kind}
        onChange={onChange}
        options={BOARDS.map((b) => ({ value: b, label: t(`leaderboard.${b}`) }))}
      />

      {meta ? <Text style={styles.meta}>{meta}</Text> : null}

      {status === "loading" && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : status === "offline" && !data ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{t("leaderboard.offline")}</Text>
          <AppButton label={t("leaderboard.retry")} onPress={() => { setStatus("loading"); load(kind); }} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={entries}
          keyExtractor={(e) => e.ref}
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.muted}
              onRefresh={async () => {
                setRefreshing(true);
                await load(kind);
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={<Text style={[styles.empty, styles.emptyList]}>{t("leaderboard.empty")}</Text>}
          renderItem={({ item }) => <Row entry={item} onPress={() => openActions(item)} />}
          ListFooterComponent={
            meBeyondList && data?.me ? (
              <>
                <Text style={styles.gap} accessibilityElementsHidden>
                  …
                </Text>
                <Row
                  entry={{ rank: data.me.rank, name: data.me.name, score: data.me.score, ref: "me", isMe: true, plus: isPlus }}
                />
              </>
            ) : null
          }
        />
      )}

      {/* "Your rank" floats bottom-right; tapping it scrolls the list to your row. */}
      <View style={styles.footer} pointerEvents="box-none">
        {!nickname && <AppButton label={t("leaderboard.setNickname")} onPress={() => promptNickname(t)} />}
        {data?.me && (
          <AppButton
            label={`n°${data.me.rank} · ${formatScore(data.me.score, i18n.language)}`}
            variant="primary"
            onPress={scrollToMe}
          />
        )}
      </View>
    </Screen>
  );
}

const CROWN_SIZE = 18;

function Row({ entry, onPress }: { entry: LeaderboardEntry; onPress?: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      disabled={entry.isMe || !onPress}
      accessibilityRole="button"
      accessibilityLabel={t("leaderboard.rowA11y", { rank: entry.rank, name: entry.name, score: entry.score })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rankCell}>
        {MEDALS[entry.rank] ? (
          <Emoji asset={MEDALS[entry.rank]} size={30} />
        ) : (
          <Text style={styles.rank} numberOfLines={1} adjustsFontSizeToFit>
            {entry.rank}
          </Text>
        )}
      </View>
      <View style={styles.nameCell}>
        <Text style={[styles.name, entry.isMe && styles.nameMe]} numberOfLines={1}>
          {entry.name}
          {entry.isMe ? ` · ${t("leaderboard.you")}` : ""}
        </Text>
        {entry.plus && <Emoji asset={UI_EMOJI.crown} size={CROWN_SIZE} label="Pairs+" />}
      </View>
      <Text style={styles.points}>{formatScore(entry.score, i18n.language)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  meta: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    textAlign: "center",
  },
  emptyList: {
    marginTop: 48,
  },
  listContent: {
    // Room for the floating "your rank" pill over the last rows.
    paddingBottom: 96,
  },
  gap: {
    color: colors.faint,
    fontSize: 18,
    textAlign: "center",
    paddingVertical: 6,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pressed: {
    opacity: 0.6,
  },
  rankCell: {
    width: 44,
    alignItems: "center",
  },
  rank: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  nameCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  nameMe: {
    fontWeight: "800",
  },
  points: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  footer: {
    // Absolute children ignore the body's padding, so the side gutter is added here.
    position: "absolute",
    right: space.screen,
    bottom: 12,
    alignItems: "flex-end",
    gap: 10,
  },
});
