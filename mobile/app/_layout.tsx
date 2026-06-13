import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/lib/theme";

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text, fontWeight: "700" },
          headerTintColor: colors.accent,
          contentStyle: { backgroundColor: colors.bg }
        }}>
        <Stack.Screen name="index"           options={{ title: "⛳ GolfGV" }} />
        <Stack.Screen name="join"            options={{ title: "Join a round", presentation: "modal" }} />
        <Stack.Screen name="new-round"       options={{ title: "Create round", presentation: "modal" }} />
        <Stack.Screen name="all-rounds"      options={{ title: "My rounds" }} />
        <Stack.Screen name="settings"        options={{ title: "Settings", presentation: "modal" }} />
        <Stack.Screen name="round/[code]"    options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
