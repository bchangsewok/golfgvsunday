// Shared types (used by both client and server).
export type Course = {
  id: string;
  name: string;
  location: string | null;
  hole_count: number;
  pars: number[];
  total_par: number;
  is_seeded: boolean;
};

export type LocalRules = {
  birdiePoints: number;
  eaglePoints: number;
  par3NearPinPoints: number;
  dfBirdieMult: number;
  dfEagleMult: number;
  saoPoints: number;
  enableDogFlight: boolean;
  enableOlympic: boolean;
  enableSao: boolean;
};

export type TeamPlaySettings = {
  parPoints: number;       // default 1 — best-of-team wins hole by par-or-worse
  birdiePoints: number;    // default 2 — winning team's best score is a birdie
  eaglePoints: number;     // default 10 — eagle or better
  teamAName: string;       // default "Team A"
  teamBName: string;       // default "Team B"
  teamAColor: string;      // hex
  teamBColor: string;      // hex
};

export type RoundSettings = {
  distanceBuckets?: Record<number, number[]>;
  maxScoreOverPar?: Record<number, number>;
  dogFlightMode?: "loser-pays-each" | "skins";
  localRules?: Partial<LocalRules>;
  teamPlay?: Partial<TeamPlaySettings>;
};

export type Round = {
  id: string;
  code: string;
  name: string;
  course_name: string | null;
  course_id: string | null;
  hole_count: number;
  player_count: number;
  stake_per_point: number;        // legacy
  dog_flight_stake: number;
  olympic_stake: number;
  currency: string;
  admin_token: string;
  settings: RoundSettings;
  status: "active" | "finished";
  team_play_enabled: 0 | 1;
  team_play_stake: number;
  created_at: string;
};

export type Player = {
  id: string;
  round_id: string;
  name: string;
  seat: number;
  color: string;
  handicap: number;
  player_token: string;
  plays_dog_flight: 0 | 1;
  applies_multiplier: 0 | 1;
  food_expenses: number;
  team: "A" | "B" | null;
};

export type Hole = {
  id: string;
  round_id: string;
  number: number;
  par: number;
  multiplier: number;
};

export type Score = {
  id: string;
  round_id: string;
  hole_id: string;
  player_id: string;
  strokes: number | null;
  on_green_distance_m: number | null;
  olympic_points: number;          // Olympic input (0..N players)
  olympic_special_points: number;  // Olympic Special input (0..15)
  sao_points: number;              // SAO special-putt: tri-state −saoPoints / 0 / +saoPoints
  updated_by: string | null;
  updated_at: string;
};
