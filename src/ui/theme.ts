// Tokens from DESIGN.md. No custom font: the system face (SF Pro / Roboto) is used everywhere.
export const colors = {
  board: "#1C1C1E",
  card: "#000000",
  text: "#F5F5F5",
  muted: "#8A8A8E",
  faint: "#5A5A5E",
  divider: "rgba(255,255,255,0.14)",
  hairline: "rgba(255,255,255,0.14)",
  buttonPrimaryText: "#0D0D0D",
  // iOS system blue (dark mode). The primary button on iOS is Apple's own `.glassProminent`,
  // which uses it; the Android fallback copies it so both platforms match.
  accent: "#0A84FF",
  accentText: "#FFFFFF",
  danger: "#FF6B6B",
} as const;

// Android stand-in for Liquid Glass (not available there): a faint frosted fill and a light
// edge, on the same capsule shapes and sizes as iOS's glass buttons.
export const glass = {
  fill: "rgba(255,255,255,0.06)",
  edge: "rgba(255,255,255,0.18)",
  primaryEdge: "rgba(255,255,255,0.28)",
  selected: "rgba(255,255,255,0.16)",
} as const;

export const radius = {
  card: 0,
  button: 12,
} as const;

export const space = {
  gridGap: 8,
  screen: 20,
  gameScreen: 16,
} as const;
