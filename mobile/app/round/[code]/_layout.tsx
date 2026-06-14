import { Stack, router } from "expo-router";
import { Pressable, Text } from "react-native";
import { useTheme, font, spacing } from "@/lib/theme";

// The round area is its own nested Stack, so Expo Router doesn't auto-render
// a back arrow on the inner root screen ("index"). We supply one explicitly
// that pops back to the outer home screen.
function BackToHome() {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      hitSlop={12}
      style={{ paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
      <Text style={{ color: colors.accent, fontSize: 24, fontWeight: "700", ...font }}>‹</Text>
    </Pressable>
  );
}

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
      <Stack.Screen
        name="index"
        options={{ title: "Round", headerLeft: () => <BackToHome /> }} />
      <Stack.Screen name="score" options={{ title: "Enter scores" }} />
    </Stack>
  );
}
