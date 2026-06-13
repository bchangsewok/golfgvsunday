"use client";

// Per-browser device identity + recent rounds.
// Device ID is a stable random UUID stored in localStorage.
// Device label is a friendly name the user can set (e.g. "Bongkarn's iPhone").

import { genToken } from "./defaults";

const KEY_ID    = "gv:device_id";
const KEY_LABEL = "gv:device_label";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY_ID);
  if (!id) {
    id = genToken();
    localStorage.setItem(KEY_ID, id);
  }
  return id;
}

export function getDeviceLabel(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY_LABEL) || "";
}

export function setDeviceLabel(label: string): void {
  if (typeof window === "undefined") return;
  if (label) localStorage.setItem(KEY_LABEL, label);
  else localStorage.removeItem(KEY_LABEL);
}

export type DeviceRound = {
  id: string;
  device_id: string;
  device_label: string | null;
  round_id: string;
  player_id: string | null;
  is_admin: 0 | 1;
  admin_token: string | null;
  first_seen: string;
  last_seen: string;
  // Joined columns from rounds:
  code: string;
  name: string;
  course_name: string | null;
  status: "active" | "finished";
  player_count: number;
  dog_flight_stake: number;
  olympic_stake: number;
  currency: string;
  created_at: string;
  // Joined columns from players (if any):
  player_name: string | null;
  player_color: string | null;
};

export async function trackRoundAccess(opts: {
  round_id: string;
  is_admin?: boolean;
  admin_token?: string | null;
  player_id?: string | null;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const device_id = getDeviceId();
  if (!device_id) return;
  try {
    await fetch("/api/device/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id,
        device_label: getDeviceLabel() || null,
        round_id: opts.round_id,
        is_admin: opts.is_admin ? 1 : 0,
        admin_token: opts.admin_token || null,
        player_id: opts.player_id || null
      })
    });
  } catch { /* best-effort */ }
}

export async function fetchDeviceRounds(): Promise<DeviceRound[]> {
  const device_id    = getDeviceId();
  const device_label = getDeviceLabel();
  if (!device_id) return [];
  try {
    const qs = new URLSearchParams({ device_id });
    if (device_label) qs.set("device_label", device_label);
    const r = await fetch(`/api/device/rounds?${qs.toString()}`);
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

export async function forgetRound(round_id: string): Promise<void> {
  const device_id = getDeviceId();
  if (!device_id) return;
  try {
    await fetch(`/api/device/rounds?device_id=${encodeURIComponent(device_id)}&round_id=${encodeURIComponent(round_id)}`,
      { method: "DELETE" });
  } catch {}
}
