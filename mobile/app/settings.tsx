import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useTheme, spacing, radii, font } from "@/lib/theme";
import { getDeviceLabel, setDeviceLabel, getDeviceId } from "@/lib/device";

export default function Settings() {
  const { colors } = useTheme();
  const [label, setLabel] = useState("");
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    (async () => {
      setLabel(await getDeviceLabel());
      setDeviceId(await getDeviceId());
    })();
  }, []);

  async function save() {
    await setDeviceLabel(label.trim());
    Alert.alert("Saved", `Device renamed to: ${label.trim() || "(no name)"}`);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.section, { color: colors.textDim, ...font }]}>DEVICE NAME</Text>
      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Bongkarn's iPhone"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, ...font }]}
      />
      <Pressable
        onPress={save}
        style={[styles.btn, { backgroundColor: colors.accent }]}>
        <Text style={{ color: colors.accentText, fontWeight: "700", ...font }}>Save</Text>
      </Pressable>
      <Text style={[styles.section, { color: colors.textDim, marginTop: spacing.xl, ...font }]}>DEVICE ID</Text>
      <Text selectable style={[styles.mono, { color: colors.textMuted, ...font }]}>
        {deviceId || "(loading…)"}
      </Text>
      <Text style={[styles.note, { color: colors.textMuted, ...font }]}>
        Stored locally on this phone. Anonymous random ID. Tap to copy if you ever need to find your device on the server.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  section: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 16 },
  btn: { marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: "center" },
  mono: { fontSize: 12, fontFamily: "Courier" },
  note: { fontSize: 12, marginTop: spacing.sm }
});
