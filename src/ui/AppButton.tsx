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
  lineLimit,
  minimumScaleFactor,
} from "@expo/ui/swift-ui/modifiers";
import {
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Emoji } from "./Emoji";
import type { EmojiAsset } from "./emojiImages";
import { colors, glass } from "./theme";

// DESIGN.md: iOS 26+ uses the native Liquid Glass material (system capsule, interactive
// highlight); everything else gets the flat radius-12 fallback.
export const USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isLiquidGlassAvailable() &&
  isGlassEffectAPIAvailable();

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
  /**
   * Icon at the button's left edge (the label stays centred). Meant for buttons given a fixed
   * `width`, so the label never runs under it.
   */
  leading?: ReactNode;
  /**
   * Replaces the label: content drawn centred over the button, for what a native label can't
   * hold (an emoji after the text). `label` is still the accessible name.
   */
  content?: ReactNode;
}

// Distance from the button's left edge to its leading icon.
const LEADING_INSET = 18;

const FONT_SIZE: Record<Size, number> = { regular: 15, large: 17, hero: 20 };
// Extra label height on top of the system button padding; only the hero size grows.
const LABEL_MIN_HEIGHT: Record<Size, number> = {
  regular: 0,
  large: 0,
  hero: 34,
};

function labelColor(variant: Variant): string {
  if (variant === "primary") return colors.accentText;
  if (variant === "destructive") return colors.danger;
  return colors.text;
}

// Pure system styles: `.glassProminent` in the system accent blue for the primary action,
// `.glass` for the rest. No custom tint — the blue is Apple's own.
function GlassButton({
  label,
  onPress,
  variant = "secondary",
  size = "regular",
  width,
  disabled = false,
  content,
}: AppButtonProps) {
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
          font({
            size: FONT_SIZE[size],
            weight: size === "hero" ? "bold" : "semibold",
          }),
          // A label never wraps: it shrinks a little first ("Daily Challenge" on two lines looked broken).
          lineLimit(1),
          minimumScaleFactor(0.8),
          ...(variant === "destructive"
            ? [foregroundStyle(colors.danger)]
            : []),
          ...sizing,
        ]}
      >
        {content ? " " : label}
      </SwiftText>
    </Button>
  );
}

// Same capsule and sizes as the iOS glass buttons (measured from them), with a frosted fill.
const FALLBACK_HEIGHT: Record<Size, number> = {
  regular: 46,
  large: 50,
  hero: 54,
};
const FALLBACK_CHROME = 40;

function FallbackButton({
  label,
  onPress,
  variant = "secondary",
  size = "regular",
  width,
  disabled = false,
  leading,
  content,
}: AppButtonProps) {
  const height = FALLBACK_HEIGHT[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { height, borderRadius: height / 2 },
        width !== undefined && { width: width + FALLBACK_CHROME },
        variant === "primary" ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {content ?? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            styles.label,
            {
              fontSize: FONT_SIZE[size],
              color:
                disabled && variant !== "primary"
                  ? colors.muted
                  : labelColor(variant),
            },
            size === "hero" && styles.labelBold,
          ]}
        >
          {label}
        </Text>
      )}
      {leading && (
        <View style={styles.leading} pointerEvents="none">
          {leading}
        </View>
      )}
    </Pressable>
  );
}

export function AppButton(props: AppButtonProps) {
  if (!USE_LIQUID_GLASS) return <FallbackButton {...props} />;
  const button = (
    <Host matchContents ignoreSafeArea="keyboard">
      <GlassButton {...props} />
    </Host>
  );
  if (!props.leading && !props.content) return button;
  // SwiftUI can't draw an RN view, so the icon sits on top of the native button.
  return (
    <View>
      {button}
      <View
        style={props.content ? styles.contentRow : styles.leading}
        pointerEvents="none"
      >
        {props.content ?? props.leading}
      </View>
    </View>
  );
}

/**
 * Buttons shown together. On iOS they share one GlassEffectContainer: glass can't sample
 * other glass, so neighbours in separate containers render inconsistently (DESIGN.md).
 */
export function AppButtonGroup({
  buttons,
  direction = "vertical",
}: {
  buttons: AppButtonProps[];
  direction?: "vertical" | "horizontal";
}) {
  if (!USE_LIQUID_GLASS) {
    return (
      <View
        style={
          direction === "vertical"
            ? styles.groupVertical
            : styles.groupHorizontal
        }
      >
        {buttons.map((b) => (
          <FallbackButton key={b.label} {...b} />
        ))}
      </View>
    );
  }
  const Stack = direction === "vertical" ? VStack : HStack;
  const group = (
    <Host matchContents ignoreSafeArea="keyboard">
      <GlassEffectContainer spacing={14}>
        <Stack spacing={14}>
          {buttons.map((b) => (
            <GlassButton key={b.label} {...b} />
          ))}
        </Stack>
      </GlassEffectContainer>
    </Host>
  );
  if (direction !== "vertical" || !buttons.some((b) => b.leading || b.content))
    return group;
  // Leading icons over a stacked group: each button's row is known from the measured heights.
  // Buttons that carry an icon are expected to share one `width`.
  const heights = buttons.map((b) => FALLBACK_HEIGHT[b.size ?? "regular"]);
  return (
    <View>
      {group}
      {buttons.map((b, i) => {
        const y = heights.slice(0, i).reduce((sum, h) => sum + h + 14, 0);
        return b.leading || b.content ? (
          <View
            key={b.label}
            pointerEvents="none"
            style={[
              b.content ? styles.contentRowAt : styles.leadingRow,
              { top: y, height: heights[i] },
            ]}
          >
            {b.content ?? b.leading}
          </View>
        ) : null;
      })}
    </View>
  );
}

const EMOJI_ICON_SIZE = 28;
// Where SF Symbols don't exist (Android), the closest vector icons, drawn centred — text glyphs
// like "‹" sat off-centre in the circle.
const FALLBACK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "chevron.left": "chevron-back",
  xmark: "close",
  "gearshape.fill": "settings-sharp",
};
const FALLBACK_ICON_SIZE = 22;
// Same as the iOS glass circle (controlSize large).
const ICON_BUTTON_SIZE = 48;

interface IconButtonProps {
  /** Spoken by VoiceOver; the button shows only the icon. */
  label: string;
  systemImage: string;
  /** Shown instead of the SF Symbol where Liquid Glass isn't available. */
  fallbackGlyph: string;
  /** Fluent 3D emoji drawn in place of the symbol. */
  emoji?: EmojiAsset;
  onPress: () => void;
}

/** Round icon-only button: native glass circle with an SF Symbol on iOS 26+. */
export function IconButton({
  label,
  systemImage,
  fallbackGlyph,
  emoji,
  onPress,
}: IconButtonProps) {
  if (USE_LIQUID_GLASS) {
    // The native glass circle keeps its own touch handling; a Fluent emoji, which SwiftUI can't
    // draw, sits on top of its (hidden) symbol.
    return (
      <View>
        <Host matchContents ignoreSafeArea="keyboard">
          <Button
            label={label}
            systemImage={systemImage as never}
            onPress={onPress}
            modifiers={[
              buttonStyle("glass"),
              labelStyle("iconOnly"),
              buttonBorderShape("circle"),
              controlSize("large"),
              ...(emoji ? [foregroundStyle("#00000000")] : []),
            ]}
          />
        </Host>
        {emoji && (
          <View style={styles.emojiOverlay} pointerEvents="none">
            <Emoji asset={emoji} size={EMOJI_ICON_SIZE} />
          </View>
        )}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
    >
      {emoji ? (
        <Emoji asset={emoji} size={EMOJI_ICON_SIZE} />
      ) : FALLBACK_ICONS[systemImage] ? (
        <Ionicons
          name={FALLBACK_ICONS[systemImage]}
          size={FALLBACK_ICON_SIZE}
          color={colors.text}
        />
      ) : (
        <Text style={styles.iconGlyph}>{fallbackGlyph}</Text>
      )}
    </Pressable>
  );
}

export function BackButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <IconButton
      label={label}
      systemImage="chevron.left"
      fallbackGlyph="‹"
      onPress={onPress}
    />
  );
}

/**
 * Close button for sheets. A sheet reached directly (deep link, notification) has nothing
 * under it, so it goes home instead of leaving the player on a page with no way out.
 */
export function CloseButton({ label }: { label: string }) {
  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  return (
    <IconButton
      label={label}
      systemImage="xmark"
      fallbackGlyph="✕"
      onPress={close}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: FALLBACK_CHROME / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: glass.primaryEdge,
  },
  secondary: {
    backgroundColor: glass.fill,
    borderColor: glass.edge,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
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
  leading: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: LEADING_INSET,
  },
  contentRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  contentRowAt: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  leadingRow: {
    position: "absolute",
    left: 0,
    justifyContent: "center",
    paddingLeft: LEADING_INSET,
  },
  icon: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: ICON_BUTTON_SIZE / 2,
    backgroundColor: glass.fill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: glass.edge,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "400",
  },
});
