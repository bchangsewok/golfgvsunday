// Client-side API wrapper (replaces supabase calls).
import type { Course, Round, Player, Hole, Score } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || "request failed");
  return res.json();
}

export const api = {
  listCourses: () => fetch("/api/courses").then(r => json<Course[]>(r)),

  createRound: (body: {
    code: string; name: string; course_name: string; course_id: string | null;
    hole_count: number; player_count: number;
    dog_flight_stake: number; olympic_stake: number;
    admin_token: string; pars: number[];
    players: { seat: number; name: string; color: string; player_token: string }[];
  }) => fetch("/api/rounds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(r => json<{ id: string; code: string; admin_token: string }>(r)),

  getRound: (code: string) => fetch(`/api/rounds/${encodeURIComponent(code)}`)
    .then(r => json<{ round: Round; players: Player[]; holes: Hole[]; scores: Score[] }>(r)),

  patchRound: (code: string, body: any) =>
    fetch(`/api/rounds/${encodeURIComponent(code)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(r => json<Round>(r)),

  patchPlayer: (id: string, body: Partial<Pick<Player, "name" | "color" | "handicap" | "plays_dog_flight" | "applies_multiplier" | "food_expenses" | "team">>) =>
    fetch(`/api/players/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(r => json<Player>(r)),

  patchHole: (id: string, body: Partial<Pick<Hole, "par" | "multiplier">>) =>
    fetch(`/api/holes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(r => json<Hole>(r)),

  upsertScore: (body: {
    round_id: string; hole_id: string; player_id: string;
    strokes?: number | null;
    on_green_distance_m?: number | null;
    olympic_points?: number;
    olympic_special_points?: number;
    sao_points?: number;
    updated_by: string;
  }) => fetch("/api/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(r => json<Score>(r))
};

// Best-effort wrapper: swallow API errors so they don't crash the page.
// Use for "fire-and-forget" UI mutations where SSE will reconcile state anyway.
export async function safeCall<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch (e) { console.warn("api call failed:", e); return null; }
}

// Server-Sent Events subscription
export function subscribeRound(code: string, onEvent: (ev: { table: string; type: string; row: any }) => void) {
  const es = new EventSource(`/api/rounds/${encodeURIComponent(code)}/stream`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data?.hello) return;
      onEvent(data);
    } catch {}
  };
  return () => es.close();
}
