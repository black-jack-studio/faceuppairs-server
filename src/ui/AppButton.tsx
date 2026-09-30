import {
  Button,
  GlassEffectContainer,
  Host,
  HStack,
  Text as SwiftText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  labelStyle,
} from "@expo/ui/swift-ui/modifiers";
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { router } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "./theme";

// DESIGN.md: iOS 26+ uses the native Liquid Glass material (system capsule, interactive
// highlight); everything else gets the flat radius-12 fallback.
export const USE_LIQUID_GLASS =
  Platform.OS === "ios" && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

type Variant = "primary" | "secondary" | "destructive";
type Size = "regular" | "large" | "hero";

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /** Fixed label width, so buttons stacked together line up at the same size. */
  width?: number;
  disabled?: boolean;
}

const FONT_SIZE: Record<Size, number> = { regular: 15, large: 17, hero: 20 };
// Extra label height on top of the system button padding; only the hero size grows.
const LABEL_MIN_HEIGHT: Record<Size, number> = { regular: 0, large: 0, hero: 34 };

function labelColor(variant: Variant): string {
  if (variant === "primary") return colors.accentText;
  if (variant === "destructive") return colors.danger;
  return colors.text;
}

// Pure system styles: `.glassProminent` in the system accent blue for the primary action,
// `.glass` for the rest. No custom tint — the blue is Apple's own.
function GlassButton({ label, onPress, variant = "secondary", size = "regular", width, disabled = false }: AppButtonProps) {
  const sizing =
    width !== undefined || LABEL_MIN_HEIGHT[size] > 0
      ? [frame({ width, minHeight: LABEL_MIN_HEIGHT[size] || undefined })]
      : [];
  return (
    <Button
      onPress={onPress}
      role={variant === "destructive" ? "destructive" : "default"}
      modifiers={[
        buttonStyle(variant === "primary" ? "glassProminent" : "glass"),
        controlSize(size === "regular" ? "large" : "extraLarge"),
        disabledModifier(disabled),
      ]}
    >
      <SwiftText
        modifiers={[
          font({ size: FONT_SIZE[size], weight: size === "hero" ? "bold" : "semibold" }),
          ...(variant === "destructive" ? [foregroundStyle(colors.danger)] : []),
          ...sizing,
        ]}
      >
        {label}
      </SwiftText>
    </Button>
  );
}

function FallbackButton({ label, onPress, variant = "secondary", size = "regular", width, disabled = false }: AppButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        size === "large" && styles.large,
        size === "hero" && styles.hero,
        width !== undefined && { width: width + 48 },
        variant === "primary" ? styles.primary : styles.secondary,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text
        style={[
          styles.label,
          { fontSize: FONT_SIZE[size], color: labelColor(variant) },
          size !== "regular" && styles.labelBold,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AppButton(props: AppButtonProps) {
  if (!USE_LIQUID_GLASS) return <FallbackButton {...props} />;
  return (
    <Host matchContents>
      <GlassButton {...props} />
    </Host>
  );
}

/**
 * Buttons shown together. On iOS they share one GlassEffectContainer: glass can't sample
 * other glass, so neighbours in separate containers render inconsistently (DESIGN.md).
 */
export function AppButtonGroup({ buttons, direction = "vertical" }: { buttons: AppButtonProps[]; direction?: "vertical" | "horizontal" }) {
  if (!USE_LIQUID_GLASS) {
    return (
      <View style={direction === "vertical" ? styles.groupVertical : styles.groupHorizontal}>
        {buttons.map((b) => (
          <FallbackButton key={b.label} {...b} />
        ))}
      </View>
    );
  }
  const Stack = direction === "vertical" ? VStack : HStack;
  return (
    <Host matchContents>
      <GlassEffectContainer spacing={14}>
        <Stack spacing={14}>
          {buttons.map((b) => (
            <GlassButton key={b.label} {...b} />
          ))}
        </Stack>
      </GlassEffectContainer>
    </Host>
  );
}

interface IconButtonProps {
  /** Spoken by VoiceOver; the button shows only the icon. */
  label: string;
  systemImage: string;
  /** Shown instead of the SF Symbol where Liquid Glass isn't available. */
  fallbackGlyph: string;
  onPress: () => void;
}

/** Round icon-only button: native glass circle with an SF Symbol on iOS 26+. */
export function IconButton({ label, systemImage, fallbackGlyph, onPress }: IconButtonProps) {
  if (USE_LIQUID_GLASS) {
    return (
      <Host matchContents>
        <Button
          label={label}
          systemImage={systemImage as never}
          onPress={onPress}
          modifiers={[buttonStyle("glass"), labelStyle("iconOnly"), buttonBorderShape("circle"), controlSize("large")]}
        />
      </Host>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={({ pressed }) => [styles.icon, pressed && styles.dimmed]}
    >
      <Text style={styles.iconGlyph}>{fallbackGlyph}</Text>
    </Pressable>
  );
}

export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <IconButton label={label} systemImage="chevron.left" fallbackGlyph="‹" onPress={onPress} />;
}

/**
 * Close button for sheets. A sheet reached directly (deep link, notification) has nothing
 * under it, so it goes home instead of leaving the player on a page with no way out.
 */
export function CloseButton({ label }: { label: string }) {
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <IconButton label={label} systemImage="xmark" fallbackGlyph="✕" onPress={close} />;
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  large: {
    minHeight: 56,
    minWidth: 220,
  },
  hero: {
    minHeight: 68,
    minWidth: 260,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  dimmed: {
    opacity: 0.6,
  },
  label: {
    fontWeight: "600",
  },
  labelBold: {
    fontWeight: "700",
  },
  groupVertical: {
    alignItems: "center",
    gap: 14,
  },
  groupHorizontal: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "400",
  },
});
