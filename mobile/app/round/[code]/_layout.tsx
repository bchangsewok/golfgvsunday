import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme";

export default function RoundLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text, fontWeight: "700" },
        headerTintColor: colors.accent,
        contentStyle: { backgroundColor: colors.bg }
      }}>
      <Stack.Screen name="index" options={{ title: "Round" }} />
      <Stack.Screen name="score" options={{ title: "Enter scores" }} />
    </Stack>
  );
}
