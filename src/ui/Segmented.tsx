import { Host, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { controlSize, frame, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { USE_LIQUID_GLASS } from "./AppButton";
import { colors, radius } from "./theme";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  stretch?: boolean;
}

export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, stretch = false }: SegmentedProps<T>) {
  // iOS 26+: Apple's own segmented control, which draws the Liquid Glass selection itself.
  if (USE_LIQUID_GLASS) {
    return (
      <Host matchContents={stretch ? { vertical: true } : true} style={stretch ? styles.stretch : undefined}>
        <Picker
          label={accessibilityLabel}
          selection={value}
          onSelectionChange={(selection) => onChange(selection as T)}
          modifiers={[pickerStyle("segmented"), controlSize("large"), ...(stretch ? [frame({ maxWidth: Infinity })] : [])]}
        >
          {options.map((option) => (
            <SwiftText key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </SwiftText>
          ))}
        </Picker>
      </Host>
    );
  }
  return (
    <View style={[styles.track, stretch && styles.stretch]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[styles.segment, stretch && styles.segmentStretch, selected && styles.selected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: 4,
    padding: 3,
    borderRadius: radius.button,
    backgroundColor: colors.card,
  },
  stretch: {
    alignSelf: "stretch",
  },
  segment: {
    minWidth: 44,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: radius.button - 3,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentStretch: {
    flex: 1,
    minHeight: 36,
  },
  selected: {
    backgroundColor: colors.text,
  },
  text: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  textSelected: {
    color: colors.buttonPrimaryText,
  },
});
