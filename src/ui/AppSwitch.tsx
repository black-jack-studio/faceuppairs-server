import { Host, Toggle } from "@expo/ui/swift-ui";
import { frame, labelsHidden, toggleStyle } from "@expo/ui/swift-ui/modifiers";
import { Switch } from "react-native";

import { USE_LIQUID_GLASS } from "./AppButton";

interface AppSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Spoken by VoiceOver; the switch shows no label. */
  label: string;
}

// iOS 26 draws a taller switch than React Native's Switch reserves room for, so it sat off
// centre in its row; SwiftUI's own Toggle sizes itself correctly.
// The iOS 26 switch draws a few points past its own frame; the inset keeps that inside the
// scroll view, which otherwise clips the knob's edge.
const SWITCH_BOX = { width: 80, height: 32, marginRight: 4 };

export function AppSwitch({ value, onValueChange, label }: AppSwitchProps) {
  if (USE_LIQUID_GLASS) {
    return (
      <Host style={SWITCH_BOX}>
        <Toggle isOn={value} label={label} onIsOnChange={onValueChange} modifiers={[toggleStyle("switch"), labelsHidden(), frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "trailing" })]} />
      </Host>
    );
  }
  return <Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} />;
}
