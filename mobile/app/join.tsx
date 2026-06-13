import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Platform, Alert
} from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radii, font } from "@/lib/theme";
import { api } from "@/lib/api";
import { trackRoundAccess } from "@/lib/device";

export default function Join() {
  const { colors, isDark } = useTheme();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerActive, setScannerActive] = useState(true);
  const scanLockedRef = useRef(false);

  const isNative = Platform.OS === "ios" || Platform.OS === "android";

  async function tryJoin(rawCode: string) {
    const c = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (c.length < 4) {
      setError("Enter at least 4 characters");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRound(c);
      if (!data?.round?.id) throw new Error("Round not found");
      if (isNative) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await trackRoundAccess({ round_id: data.round.id });
      router.replace({ pathname: "/round/[code]", params: { code: c } });
    } catch (e: any) {
      if (isNative) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message?.includes("404") ? "Round not found" : (e?.message || "Couldn't join"));
      scanLockedRef.current = false;          // re-arm scanner
    } finally {
      setLoading(false);
    }
  }

  function onScan({ data }: { data: string }) {
    if (scanLockedRef.current) return;
    scanLockedRef.current = true;
    // Accept either the raw 6-char code, OR a full join URL with /round/CODE
    const m = data.match(/\/round\/([A-Z0-9]{4,8})/i);
    const code = (m ? m[1] : data).toUpperCase();
    setCode(code);
    tryJoin(code);
  }

  // Camera permission gating — only matters on native
  if (isNative && !permission) {
    return <View style={[styles.fill, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.accent} /></View>;
  }
  if (isNative && !permission?.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text, ...font }]}>Camera permission</Text>
        <Text style={[styles.sub, { color: colors.textDim, ...font }]}>
          GolfGV uses the camera to scan round QR codes shared by your friends. You can also type the
          code manually if you prefer.
        </Text>
        <Pressable onPress={requestPermission} style={[styles.btnPrimary, { backgroundColor: colors.accent }]}>
          <Text style={[styles.btnPrimaryText, { color: colors.accentText, ...font }]}>Grant camera access</Text>
        </Pressable>
        <Pressable onPress={() => { /* keep going; user will use code input */ }}
                   style={[styles.btnGhost, { borderColor: colors.border }]}>
          <Text style={[styles.btnGhostText, { color: colors.text, ...font }]}>Skip — I'll type the code</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Viewfinder area — camera on native, illustration on web */}
      <View style={styles.viewfinderWrap}>
        {isNative && scannerActive ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onScan}
          />
        ) : (
          <View style={[styles.webFallback, { backgroundColor: colors.card }]}>
            <Text style={{ fontSize: 64 }}>📷</Text>
            <Text style={[styles.webFallbackText, { color: colors.textDim, ...font }]}>
              Camera scan available on the iOS / Android build.
              For now, type the code below.
            </Text>
          </View>
        )}
        {/* Crosshair overlay */}
        {isNative && scannerActive && (
          <View pointerEvents="none" style={styles.crosshairWrap}>
            <View style={[styles.crosshair, { borderColor: colors.accent }]} />
            <Text style={[styles.viewfinderHint, { color: "#fff", ...font }]}>Point at a GolfGV QR</Text>
          </View>
        )}
      </View>

      {/* Code input */}
      <View style={[styles.bottomCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textDim, ...font }]}>OR ENTER CODE</Text>
        <View style={[styles.codeRow, { backgroundColor: isDark ? "#0b1220" : "#f1f5f9", borderColor: colors.border }]}>
          <TextInput
            value={code}
            onChangeText={t => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            placeholder="ABC123"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            style={[styles.codeInput, { color: colors.text, ...font }]}
            onSubmitEditing={() => tryJoin(code)}
            returnKeyType="go"
          />
        </View>
        {error && (
          <Text style={[styles.errorText, { color: colors.danger, ...font }]}>{error}</Text>
        )}
        <Pressable
          onPress={() => tryJoin(code)}
          disabled={loading || code.length < 4}
          style={[styles.joinBtn, { backgroundColor: colors.accent, opacity: (loading || code.length < 4) ? 0.5 : 1 }]}>
          {loading
            ? <ActivityIndicator color={colors.accentText} />
            : <Text style={[styles.joinBtnText, { color: colors.accentText, ...font }]}>Join round</Text>}
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.textDim, ...font }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill:      { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1 },
  center:    { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  title:     { fontSize: 22, fontWeight: "700" },
  sub:       { fontSize: 14, textAlign: "center", marginBottom: spacing.md, lineHeight: 20 },

  viewfinderWrap: { flex: 1, position: "relative", overflow: "hidden" },
  webFallback:    { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  webFallbackText:{ fontSize: 14, textAlign: "center", maxWidth: 300 },

  crosshairWrap:  { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  crosshair:      { width: 220, height: 220, borderWidth: 3, borderRadius: 24 },
  viewfinderHint: { position: "absolute", bottom: -40, fontSize: 13, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },

  bottomCard: {
    padding: spacing.lg, gap: spacing.md,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    borderTopWidth: 1
  },
  label:     { fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  codeRow:   { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 6 },
  codeInput: { fontSize: 28, fontWeight: "800", textAlign: "center", letterSpacing: 8, fontVariant: ["tabular-nums"] },
  errorText: { fontSize: 13, textAlign: "center" },

  joinBtn:      { paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: "center" },
  joinBtnText:  { fontSize: 16, fontWeight: "700" },
  cancelBtn:    { alignItems: "center", paddingVertical: spacing.sm },
  cancelText:   { fontSize: 14 },

  btnPrimary:     { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radii.lg },
  btnPrimaryText: { fontSize: 16, fontWeight: "700" },
  btnGhost:       { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radii.lg, borderWidth: 1 },
  btnGhostText:   { fontSize: 14 }
});
