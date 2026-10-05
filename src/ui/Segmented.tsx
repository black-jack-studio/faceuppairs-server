import { Host, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import { controlSize, frame, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { USE_LIQUID_GLASS } from "./AppButton";
import { colors, glass } from "./theme";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  stretch?: boolean;
  /** Fixed width, for a control sitting next to a label. */
  width?: number;
}

export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, stretch = false, width }: SegmentedProps<T>) {
  // iOS 26+: Apple's own segmented control, which draws the Liquid Glass selection itself.
  if (USE_LIQUID_GLASS) {
    return (
      <Host
        matchContents={stretch ? { vertical: true } : true}
        style={stretch ? styles.stretch : undefined}
        ignoreSafeArea="all"
      >
        <Picker
          label={accessibilityLabel}
          selection={value}
          onSelectionChange={(selection) => onChange(selection as T)}
          modifiers={[
            pickerStyle("segmented"),
            // Full-width tab bars get the large size; a picker next to a label stays regular.
            controlSize(stretch ? "large" : "regular"),
            ...(stretch ? [frame({ maxWidth: Infinity })] : width !== undefined ? [frame({ width })] : []),
          ]}
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
    <View style={[styles.track, stretch && styles.stretch, width !== undefined && { width }]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[styles.segment, (stretch || width !== undefined) && styles.segmentStretch, selected && styles.selected]}
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
  // Android: same capsule as iOS's segmented control, frosted, with a lighter pill.
  track: {
    flexDirection: "row",
    gap: 4,
    padding: 3,
    borderRadius: 999,
    backgroundColor: glass.fill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: glass.edge,
  },
  stretch: {
    alignSelf: "stretch",
  },
  segment: {
    minWidth: 44,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentStretch: {
    flex: 1,
    minHeight: 36,
  },
  selected: {
    backgroundColor: glass.selected,
  },
  text: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  textSelected: {
    color: colors.text,
  },
});
