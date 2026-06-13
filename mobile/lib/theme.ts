// Native-feeling theme. Light/dark detected from system, accent customizable.
import { Platform, useColorScheme } from "react-native";

export type ThemeColors = {
  bg: string;
  surface: string;
  card: string;
  text: string;
  textDim: string;
  textMuted: string;
  border: string;
  accent: string;
  accentText: string;
  danger: string;
  success: string;
  warning: string;
  birdie: string;   // red — Asian scorecard convention
  bogey: string;    // dark blue
  par: string;
};

export const lightColors: ThemeColors = {
  bg:        "#f1f5f9",
  surface:   "#ffffff",
  card:      "#ffffff",
  text:      "#0f172a",
  textDim:   "#475569",
  textMuted: "#94a3b8",
  border:    "#e2e8f0",
  accent:    "#16a34a",
  accentText:"#ffffff",
  danger:    "#dc2626",
  success:   "#16a34a",
  warning:   "#f59e0b",
  birdie:    "#dc2626",
  bogey:     "#1e3a8a",
  par:       "#94a3b8"
};

export const darkColors: ThemeColors = {
  bg:        "#0b1220",
  surface:   "#0f172a",
  card:      "#1e293b",
  text:      "#f1f5f9",
  textDim:   "#cbd5e1",
  textMuted: "#64748b",
  border:    "#334155",
  accent:    "#22c55e",
  accentText:"#0f172a",
  danger:    "#ef4444",
  success:   "#22c55e",
  warning:   "#f59e0b",
  birdie:    "#ef4444",
  bogey:     "#3b82f6",
  par:       "#64748b"
};

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { colors: isDark ? darkColors : lightColors, isDark };
}

// Native typography — uses platform defaults for that "native feel"
export const font = Platform.select({
  ios: { fontFamily: "System" },
  android: { fontFamily: "sans-serif" },
  default: { fontFamily: "system-ui" }
});

export const radii = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
