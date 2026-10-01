import { Platform } from "react-native";

// Safe-area edges for the content of a sheet. On iOS the sheet starts under the status bar,
// so the top inset is needed; on Android it rises from the bottom and that inset only added
// an empty band above the title.
export const SHEET_EDGES = Platform.OS === "ios" ? (["top"] as const) : ([] as const);
