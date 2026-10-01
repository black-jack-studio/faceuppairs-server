import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

import { PerfectBurst } from "./PerfectBurst";
import { Flyby, Fountain, Rain } from "./Particles";
import { useFx } from "./store";

/** Above every screen. Only the perfect-board celebration takes touches. */
export function FxLayer() {
  const current = useFx((s) => s.current);
  const id = current?.id;
  const finish = useCallback(() => {
    if (id !== undefined) useFx.getState().done(id);
  }, [id]);

  if (!current) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={current.kind === "perfect" ? "auto" : "none"}>
      {current.kind === "perfect" ? (
        <PerfectBurst key={current.id} emojis={current.emojis} onDone={finish} />
      ) : current.kind === "flyby" ? (
        <Flyby key={current.id} sprite={current.sprite} trail={current.trail} onDone={finish} />
      ) : current.kind === "fountain" ? (
        <Fountain key={current.id} sprites={current.sprites} onDone={finish} />
      ) : (
        <Rain key={current.id} sprites={current.sprites} onDone={finish} />
      )}
    </View>
  );
}
