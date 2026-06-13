// Mobile API client — talks to the same Azure-hosted backend as the web app.
import Constants from "expo-constants";
import type { Round, Player, Hole, Score, Course, DeviceRound } from "./types";

const API_BASE: string = (Constants.expoConfig?.extra as any)?.apiBase || "https://golfgv-bchangsewok.azurewebsites.net";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(msg?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  return json<T>(res);
}

export const api = {
  base: API_BASE,
  listCourses: () => req<Course[]>("/api/courses"),

  createRound: (body: {
    code: string; name: string;
    course_name: string; course_id: string | null;
    hole_count: number; player_count: number;
    dog_flight_stake: number; olympic_stake: number;
    admin_token: string; pars: number[];
    players: { seat: number; name: string; color: string; player_token: string }[];
  }) => req<{ id: string; code: string; admin_token: string }>("/api/rounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }),

  getRound: (code: string) =>
    req<{ round: Round; players: Player[]; holes: Hole[]; scores: Score[] }>(
      `/api/rounds/${encodeURIComponent(code)}`
    ),

  patchPlayer: (id: string, body: Partial<Player>) =>
    req<Player>(`/api/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),

  patchHole: (id: string, body: Partial<Hole>) =>
    req<Hole>(`/api/holes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),

  upsertScore: (body: {
    round_id: string; hole_id: string; player_id: string;
    strokes?: number | null;
    olympic_points?: number; olympic_special_points?: number;
    sao_points?: number;
    updated_by: string;
  }) => req<Score>("/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }),

  // Device tracking
  trackRound: (body: {
    device_id: string; device_label?: string | null;
    round_id: string; is_admin?: 0 | 1;
    admin_token?: string | null; player_id?: string | null;
  }) => req<{ ok: true }>("/api/device/rounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }),
  listDeviceRounds: (device_id: string) =>
    req<DeviceRound[]>(`/api/device/rounds?device_id=${encodeURIComponent(device_id)}`),
  forgetDeviceRound: (device_id: string, round_id: string) =>
    req<{ ok: true }>(`/api/device/rounds?device_id=${encodeURIComponent(device_id)}&round_id=${encodeURIComponent(round_id)}`,
      { method: "DELETE" })
};

// Server-Sent Events subscription using react-native-event-source.
// Returns a cleanup function.
export function subscribeRound(code: string, onEvent: (ev: { table: string; type: string; row: any }) => void): () => void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const EventSource = require("react-native-event-source").default;
  const es = new EventSource(`${API_BASE}/api/rounds/${encodeURIComponent(code)}/stream`);
  es.addEventListener("message", (e: any) => {
    try {
      const data = JSON.parse(e.data);
      if (data?.hello) return;
      onEvent(data);
    } catch {}
  });
  return () => es.removeAllListeners?.() || es.close?.();
}
