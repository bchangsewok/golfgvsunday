// Per-device identity — random UUID stored on the phone via AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const KEY_ID = "gv:device_id";
const KEY_LABEL = "gv:device_label";

function genToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }).replace(/-/g, "");
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEY_ID);
  if (!id) {
    id = genToken();
    await AsyncStorage.setItem(KEY_ID, id);
  }
  return id;
}

export async function getDeviceLabel(): Promise<string> {
  return (await AsyncStorage.getItem(KEY_LABEL)) || "";
}

export async function setDeviceLabel(label: string): Promise<void> {
  if (label) await AsyncStorage.setItem(KEY_LABEL, label);
  else await AsyncStorage.removeItem(KEY_LABEL);
}

export async function trackRoundAccess(opts: {
  round_id: string;
  is_admin?: boolean;
  admin_token?: string | null;
  player_id?: string | null;
}): Promise<void> {
  try {
    const device_id = await getDeviceId();
    const device_label = await getDeviceLabel();
    await api.trackRound({
      device_id,
      device_label: device_label || null,
      round_id: opts.round_id,
      is_admin: opts.is_admin ? 1 : 0,
      admin_token: opts.admin_token || null,
      player_id: opts.player_id || null
    });
  } catch { /* best-effort */ }
}

export async function fetchDeviceRounds() {
  try {
    const id = await getDeviceId();
    return await api.listDeviceRounds(id);
  } catch { return []; }
}

export async function forgetRound(round_id: string) {
  const id = await getDeviceId();
  await api.forgetDeviceRound(id, round_id);
}
