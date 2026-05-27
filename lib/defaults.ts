import type { RoundSettings, LocalRules, TeamPlaySettings } from "./types";

// Distance buckets (meters) — closer = better. Index 0 is closest bucket.
// Used for "nearest on green" point ranking, scaled by player count.
export const DEFAULT_DISTANCE_BUCKETS: Record<number, number[]> = {
  1: [99],
  2: [2, 99],
  3: [1, 3, 99],
  4: [1, 2, 4, 99],
  5: [1, 2, 3, 5, 99],
  6: [0.5, 1, 2, 3, 5, 99]
};

// Max strokes above par allowed per hole, by player count.
export const DEFAULT_MAX_SCORE_OVER_PAR: Record<number, number> = {
  1: 5, 2: 5, 3: 4, 4: 4, 5: 3, 6: 3
};

export const DEFAULT_LOCAL_RULES: LocalRules = {
  birdiePoints: 3,
  eaglePoints: 5,
  par3NearPinPoints: 3,
  dfBirdieMult: 2,
  dfEagleMult: 5,
  saoPoints: 3,
  enableDogFlight: true,
  enableOlympic: true,
  enableSao: true
};

export const DEFAULT_TEAM_PLAY: TeamPlaySettings = {
  parPoints: 1,
  birdiePoints: 2,
  eaglePoints: 10,
  teamAName: "Team A",
  teamBName: "Team B",
  teamAColor: "#16a34a",
  teamBColor: "#dc2626"
};

export type MergedSettings = {
  distanceBuckets: Record<number, number[]>;
  maxScoreOverPar: Record<number, number>;
  dogFlightMode: "loser-pays-each" | "skins";
  localRules: LocalRules;
  teamPlay: TeamPlaySettings;
};

export function mergedSettings(s: RoundSettings | null | undefined): MergedSettings {
  return {
    distanceBuckets: { ...DEFAULT_DISTANCE_BUCKETS, ...(s?.distanceBuckets || {}) },
    maxScoreOverPar: { ...DEFAULT_MAX_SCORE_OVER_PAR, ...(s?.maxScoreOverPar || {}) },
    dogFlightMode: s?.dogFlightMode ?? "loser-pays-each",
    localRules: { ...DEFAULT_LOCAL_RULES, ...(s?.localRules || {}) },
    teamPlay: { ...DEFAULT_TEAM_PLAY, ...(s?.teamPlay || {}) }
  };
}

export function distanceBucketIndex(distance_m: number, buckets: number[]): number {
  for (let i = 0; i < buckets.length; i++) if (distance_m <= buckets[i]) return i;
  return buckets.length - 1;
}

export function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function genToken(): string {
  // crypto.randomUUID() requires a secure context (HTTPS or localhost).
  // For deployments on plain HTTP we fall back to a Math.random-based UUIDv4 — fine
  // for round/admin tokens since they're not security-critical (anyone with the
  // link is already trusted by the round creator).
  const uuid =
    (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function")
      ? (crypto as any).randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return uuid.replace(/-/g, "");
}

export const PLAYER_COLORS = [
  "#16a34a", "#0ea5e9", "#f59e0b", "#dc2626", "#a855f7", "#0891b2"
];
