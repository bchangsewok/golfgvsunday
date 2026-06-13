import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, FlatList, ActivityIndicator, Platform, Alert
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radii, font } from "@/lib/theme";
import { api } from "@/lib/api";
import { genCode, genToken, PLAYER_COLORS } from "@/lib/defaults";
import { trackRoundAccess, getDeviceLabel } from "@/lib/device";
import type { Course } from "@/lib/types";

// YYMMDD for today's local date
function yymmdd(d = new Date()): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export default function NewRound() {
  const { colors, isDark } = useTheme();
  const [name, setName]               = useState(`Round ${yymmdd()}`);
  const [courses, setCourses]         = useState<Course[]>([]);
  const [courseId, setCourseId]       = useState<string | "custom" | "">("");
  const [customName, setCustomName]   = useState("");
  const [holes, setHoles]             = useState(18);
  const [playerCount, setPlayerCount] = useState(4);
  const [dfStake, setDfStake]         = useState(100);
  const [olyStake, setOlyStake]       = useState(10);
  const [playerNames, setPlayerNames] = useState<string[]>(Array.from({ length: 6 }, (_, i) => `Player ${i + 1}`));
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    api.listCourses()
      .then(setCourses)
      .catch(e => setError(`Couldn't load courses: ${e?.message || e}. API: ${api.base}`));
    // Seed default round name from device label, e.g. "Bongkarn's iPhone 260613"
    getDeviceLabel().then(label => {
      if (label) setName(`${label} ${yymmdd()}`);
    });
  }, []);
  const selectedCourse = useMemo(() => courses.find(c => c.id === courseId), [courses, courseId]);
  const isCustom = courseId === "custom";

  // When picking a seeded course, auto-set hole count.
  useEffect(() => {
    if (selectedCourse) setHoles(selectedCourse.hole_count);
  }, [selectedCourse]);

  function setPlayerName(i: number, v: string) {
    setPlayerNames(arr => { const next = [...arr]; next[i] = v; return next; });
  }

  async function submit() {
    if (!courseId) { setError("Pick a course"); return; }
    if (isCustom && !customName.trim()) { setError("Enter a custom course name"); return; }
    setSubmitting(true);
    setError(null);
    if (isNative) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const code = genCode();
      const admin_token = genToken();
      const pars   = isCustom ? Array(holes).fill(4) : (selectedCourse!.pars.slice(0, holes));
      const cName  = isCustom ? customName.trim()    : selectedCourse!.name;
      const players = Array.from({ length: playerCount }, (_, i) => ({
        seat: i + 1,
        name: playerNames[i] || `Player ${i + 1}`,
        color: PLAYER_COLORS[i],
        player_token: genToken()
      }));
      const res = await api.createRound({
        code, name,
        course_name: cName,
        course_id: isCustom ? null : selectedCourse!.id,
        hole_count: holes, player_count: playerCount,
        dog_flight_stake: dfStake, olympic_stake: olyStake,
        admin_token, pars, players
      });
      // Register THIS device as round admin
      await trackRoundAccess({ round_id: res.id, is_admin: true, admin_token: res.admin_token });
      if (isNative) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to round home with admin token preserved
      router.replace({ pathname: "/round/[code]", params: { code: res.code, admin: res.admin_token } });
    } catch (e: any) {
      if (isNative) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message || "Failed to create round");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <Text style={[styles.label, { color: colors.textDim, ...font }]}>ROUND NAME</Text>
      <TextInput value={name} onChangeText={setName}
        style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border, ...font }]} />

      <Text style={[styles.label, { color: colors.textDim, ...font, marginTop: spacing.lg }]}>COURSE</Text>
      <Pressable onPress={() => setCoursePickerOpen(true)}
        style={[styles.pickerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.pickerText, { color: courseId ? colors.text : colors.textMuted, ...font }]}>
          {isCustom ? "Custom course…" :
            selectedCourse ? `${selectedCourse.name} · Par ${selectedCourse.total_par}` :
            "— Tap to pick —"}
        </Text>
        <Text style={[styles.chev, { color: colors.textDim }]}>›</Text>
      </Pressable>
      {isCustom && (
        <TextInput value={customName} onChangeText={setCustomName} placeholder="Course name"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border, marginTop: spacing.xs, ...font }]} />
      )}

      <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textDim, ...font }]}>HOLES</Text>
          <Stepper value={holes} options={[9, 18]} onChange={setHoles} colors={colors} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textDim, ...font }]}>PLAYERS</Text>
          <Stepper value={playerCount} min={1} max={6} onChange={setPlayerCount} colors={colors} />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textDim, ...font }]}>🗡️  DF / PT (THB)</Text>
          <NumberInput value={dfStake} onChange={setDfStake} colors={colors} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textDim, ...font }]}>🏆  OLY / PT (THB)</Text>
          <NumberInput value={olyStake} onChange={setOlyStake} colors={colors} />
        </View>
      </View>

      <Text style={[styles.label, { color: colors.textDim, ...font, marginTop: spacing.lg }]}>PLAYER NAMES</Text>
      {Array.from({ length: playerCount }, (_, i) => i).map(i => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
          <View style={[styles.colorDot, { backgroundColor: PLAYER_COLORS[i] }]} />
          <TextInput value={playerNames[i]} onChangeText={v => setPlayerName(i, v)}
            placeholder={`Player ${i + 1}`}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { flex: 1, color: colors.text, backgroundColor: colors.card, borderColor: colors.border, ...font }]} />
        </View>
      ))}

      {error && <Text style={[styles.errorText, { color: colors.danger, ...font }]}>{error}</Text>}

      <Text style={[styles.debugText, { color: colors.textMuted, ...font }]}>
        api: {api.base}  ·  {courses.length} courses loaded
      </Text>

      <Pressable onPress={submit} disabled={submitting}
        style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: submitting ? 0.5 : 1 }]}>
        {submitting
          ? <ActivityIndicator color={colors.accentText} />
          : <Text style={[styles.submitText, { color: colors.accentText, ...font }]}>Create round</Text>}
      </Pressable>
      <Pressable onPress={() => router.back()} style={{ alignItems: "center", marginTop: spacing.sm, paddingVertical: spacing.sm }}>
        <Text style={[styles.cancelText, { color: colors.textDim, ...font }]}>Cancel</Text>
      </Pressable>

      {/* Course picker modal */}
      <Modal visible={coursePickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCoursePickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <Text style={[{ color: colors.text, fontSize: 18, fontWeight: "700", ...font }]}>Pick a course</Text>
            <Pressable onPress={() => setCoursePickerOpen(false)}>
              <Text style={{ color: colors.accent, fontWeight: "700", ...font }}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={courses}
            keyExtractor={c => c.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => { setCourseId(item.id); setCoursePickerOpen(false); }}
                style={[styles.courseCard, { backgroundColor: colors.card, borderColor: courseId === item.id ? colors.accent : colors.border }]}>
                <View>
                  <Text style={[{ color: colors.text, fontWeight: "600", ...font }]}>{item.name}</Text>
                  {item.location && <Text style={[{ color: colors.textDim, fontSize: 12, ...font }]}>📍 {item.location}</Text>}
                </View>
                <Text style={[{ color: colors.accent, fontWeight: "700", ...font }]}>Par {item.total_par}</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
            ListFooterComponent={
              <Pressable onPress={() => { setCourseId("custom"); setCoursePickerOpen(false); }}
                style={[styles.courseCard, { backgroundColor: colors.card, borderColor: courseId === "custom" ? colors.accent : colors.border, marginTop: spacing.md }]}>
                <Text style={[{ color: colors.text, fontWeight: "600", ...font }]}>+ Custom course…</Text>
              </Pressable>
            }
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

function Stepper({ value, options, min, max, onChange, colors }:
  { value: number; options?: number[]; min?: number; max?: number; onChange: (v: number) => void; colors: any }) {
  function dec() {
    if (options) { const i = options.indexOf(value); onChange(options[Math.max(0, i - 1)]); }
    else onChange(Math.max(min ?? 0, value - 1));
  }
  function inc() {
    if (options) { const i = options.indexOf(value); onChange(options[Math.min(options.length - 1, i + 1)]); }
    else onChange(Math.min(max ?? 9, value + 1));
  }
  return (
    <View style={[styles.stepperWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable onPress={dec} style={styles.stepperBtn}><Text style={{ color: colors.text, fontSize: 22, ...font }}>−</Text></Pressable>
      <Text style={[styles.stepperVal, { color: colors.text, ...font }]}>{value}</Text>
      <Pressable onPress={inc} style={styles.stepperBtn}><Text style={{ color: colors.text, fontSize: 22, ...font }}>+</Text></Pressable>
    </View>
  );
}

function NumberInput({ value, onChange, colors }: { value: number; onChange: (n: number) => void; colors: any }) {
  return (
    <TextInput
      value={String(value)}
      onChangeText={t => onChange(Number(t.replace(/[^0-9]/g, "")) || 0)}
      keyboardType="number-pad"
      style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border, textAlign: "center", fontSize: 18, fontWeight: "700", ...font }]}
    />
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16 },

  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
               borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  pickerText: { fontSize: 15, flex: 1 },
  chev: { fontSize: 22 },

  stepperWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                 borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 4 },
  stepperBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepperVal: { fontSize: 18, fontWeight: "700" },

  colorDot: { width: 12, height: 12, borderRadius: 6 },

  errorText: { textAlign: "center", marginTop: spacing.md, fontSize: 13 },
  debugText: { textAlign: "center", marginTop: spacing.sm, fontSize: 10 },
  submitBtn: { marginTop: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: "center" },
  submitText: { fontSize: 16, fontWeight: "700" },
  cancelText: { fontSize: 14 },

  courseCard: { padding: spacing.md, borderRadius: radii.lg, borderWidth: 2, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }
});
