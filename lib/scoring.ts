import type { Hole, Player, Score, RoundSettings } from "./types";
import { mergedSettings } from "./defaults";

export type PerHoleResult = {
  holeId: string;
  holeNumber: number;
  par: number;
  multiplier: number;
  dogFlightPoints: Record<string, number>;   // pairwise pts × hole.multiplier (no stake)
  dogFlightMoney:  Record<string, number>;   // = dogFlightPoints × stake
  olympic:        Record<string, number>;    // (olympic_points + olympic_special_points) net per hole
  sao:            Record<string, number>;    // SAO ±value net per hole
  total:          Record<string, number>;
  awards: { playerId: string; kind: "birdie" | "eagle" | "manual" | "near_pin" | "sao"; points: number }[];
};

export type TotalsResult = {
  perHole: PerHoleResult[];
  dogFlightPointsTotal: Record<string, number>;
  dogFlightTotal:       Record<string, number>;   // THB
  olympicTotal:         Record<string, number>;   // (manual + special) net pts
  olympicExtraTotal:    Record<string, number>;   // derived from olympic_points only, zero-sum net pts
  olympicExtraRaw:      Record<string, number>;   // raw per-player sum of olympic_points (Σ value × count)
  saoTotal:             Record<string, number>;
  grandTotal:           Record<string, number>;
  money:                Record<string, number>;   // THB grand total
  dogFlightMoney:       Record<string, number>;
  olympicMoney:         Record<string, number>;
  olympicExtraMoney:    Record<string, number>;
  saoMoney:             Record<string, number>;
};

function scoresByHoleMap(scores: Score[]): Map<string, Map<string, Score>> {
  const m = new Map<string, Map<string, Score>>();
  for (const s of scores) {
    if (!m.has(s.hole_id)) m.set(s.hole_id, new Map());
    m.get(s.hole_id)!.set(s.player_id, s);
  }
  return m;
}

// ─────────────────────────────────────────────────────────────
// DOG FLIGHT (pairwise). Pair compared by strokes; ties → 0.
//   Pair POINTS = 1 × bonus  (bonus = dfEagleMult/dfBirdieMult/1)
//   Pair MONEY  = points × stake × hole.multiplier
//
// Example: par 4, ×2 hole, stake 100. P1 birdie (3) vs P2 par (4) vs P3 bogey (5).
//   Pair P1-P2 birdie pair: 1×2 = 2 pts to P1, money = 2×100×2 = 400.
//   Pair P1-P3 birdie pair: 2 pts, money 400.
//   Pair P2-P3 par pair:    1 pt to P2, money 200.
// ─────────────────────────────────────────────────────────────
function calcDogFlight(
  players: Player[],
  hole: Hole,
  holeScores: Map<string, Score>,
  dogFlightStake: number,
  dfBirdieMult: number,
  dfEagleMult: number
): { points: Record<string, number>; money: Record<string, number> } {
  const points: Record<string, number> = {};
  const money:  Record<string, number> = {};
  players.forEach(p => { points[p.id] = 0; money[p.id] = 0; });

  // Only players who opted in to Dog Flight participate.
  const entered = players
    .filter(p => (p.plays_dog_flight ?? 1) === 1)
    .map(p => ({ p, s: holeScores.get(p.id) }))
    .filter(x => x.s && x.s.strokes != null) as { p: Player; s: Score }[];
  if (entered.length < 2) return { points, money };

  for (let i = 0; i < entered.length; i++) {
    for (let j = i + 1; j < entered.length; j++) {
      const a = entered[i], b = entered[j];
      if (a.s.strokes === b.s.strokes) continue;
      const winner = a.s.strokes! < b.s.strokes! ? a : b;
      const loser  = winner === a ? b : a;
      const diff = winner.s.strokes! - hole.par;
      const bonus = diff <= -2 ? dfEagleMult : (diff === -1 ? dfBirdieMult : 1);
      // Hole multiplier applies only if BOTH players in the pair have opted in.
      // Keeps zero-sum: each pair pays itself out symmetrically.
      const mult = ((winner.p.applies_multiplier ?? 1) === 1 &&
                    (loser.p.applies_multiplier  ?? 1) === 1) ? hole.multiplier : 1;
      const pairPts = bonus * mult;
      points[winner.p.id] += pairPts;
      points[loser.p.id]  -= pairPts;
    }
  }
  for (const p of players) money[p.id] = points[p.id] * dogFlightStake;
  return { points, money };
}

// ─────────────────────────────────────────────────────────────
// OLYMPIC (achievement + manual). Achiever gains, every opponent pays the bonus × hole.multiplier.
// Manual: per-player olympic_points field (-3..+15) is summed with achievement bonus.
// ─────────────────────────────────────────────────────────────
// OLYMPIC (manual + special). Combines olympic_points (0..N) and olympic_special_points (0..15).
// Zero-sum: each entered point ⇒ payer-pays-each-opponent.
function calcOlympic(
  players: Player[],
  _hole: Hole,
  holeScores: Map<string, Score>
): { result: Record<string, number>; awards: PerHoleResult["awards"] } {
  const result: Record<string, number> = {};
  const awards: PerHoleResult["awards"] = [];
  players.forEach(p => (result[p.id] = 0));

  const entered = players
    .map(p => ({ p, s: holeScores.get(p.id) }))
    .filter(x => x.s) as { p: Player; s: Score }[];
  if (entered.length < 2) return { result, awards };

  for (const { p, s } of entered) {
    const olp     = Math.max(0,  Math.min(9,  Number(s.olympic_points)         || 0));
    const special = Math.max(-3, Math.min(15, Number(s.olympic_special_points) || 0));
    const v = olp + special;
    if (v === 0) continue;
    awards.push({ playerId: p.id, kind: "manual", points: v });
    for (const other of entered) {
      if (other.p.id === p.id) continue;
      result[p.id] += v;
      result[other.p.id] -= v;
    }
  }
  return { result, awards };
}

// ─────────────────────────────────────────────────────────────
// PAR-3 NEAREST-PIN. Outright closest distance wins. Ties → no payout.
// Zero-sum, NO hole-multiplier on points.
// ─────────────────────────────────────────────────────────────
function calcNearPin(
  players: Player[],
  hole: Hole,
  holeScores: Map<string, Score>,
  nearPinPoints: number
): { result: Record<string, number>; award: { playerId: string; points: number } | null } {
  const result: Record<string, number> = {};
  players.forEach(p => (result[p.id] = 0));
  if (hole.par !== 3) return { result, award: null };

  const entered = players
    .map(p => ({ p, s: holeScores.get(p.id) }))
    .filter(x => x.s && x.s.on_green_distance_m != null) as { p: Player; s: Score }[];
  if (entered.length < 2) return { result, award: null };

  entered.sort((a, b) => a.s.on_green_distance_m! - b.s.on_green_distance_m!);
  const best = entered[0].s.on_green_distance_m!;
  const winners = entered.filter(x => x.s.on_green_distance_m === best);
  if (winners.length !== 1) return { result, award: null };

  const winner = winners[0].p;
  const losers = entered.filter(x => x.p.id !== winner.id);
  for (const l of losers) {
    result[winner.id] += nearPinPoints;
    result[l.p.id] -= nearPinPoints;
  }
  return { result, award: { playerId: winner.id, points: nearPinPoints } };
}

// ─────────────────────────────────────────────────────────────
// SAO. Tri-state per player: +saoPoints / 0 / −saoPoints (already stored signed).
// Zero-sum, NO hole-multiplier on points.
// ─────────────────────────────────────────────────────────────
function calcSao(
  players: Player[],
  _hole: Hole,
  holeScores: Map<string, Score>
): { result: Record<string, number>; awards: PerHoleResult["awards"] } {
  const result: Record<string, number> = {};
  const awards: PerHoleResult["awards"] = [];
  players.forEach(p => (result[p.id] = 0));

  const entered = players
    .map(p => ({ p, s: holeScores.get(p.id) }))
    .filter(x => x.s) as { p: Player; s: Score }[];
  if (entered.length < 2) return { result, awards };

  for (const { p, s } of entered) {
    const sao = Number(s.sao_points) || 0;
    if (sao === 0) continue;
    awards.push({ playerId: p.id, kind: "sao", points: sao });
    for (const other of entered) {
      if (other.p.id === p.id) continue;
      result[p.id] += sao;
      result[other.p.id] -= sao;
    }
  }
  return { result, awards };
}

export function calculate(
  players: Player[],
  holes: Hole[],
  scores: Score[],
  settings: RoundSettings | undefined,
  stakes: { dogFlight: number; olympic: number }
): TotalsResult {
  const cfg = mergedSettings(settings);
  const rules = cfg.localRules;
  const byHole = scoresByHoleMap(scores);

  const perHole: PerHoleResult[] = [];
  const dfPtsTotal: Record<string, number> = {};
  const dfTotal:    Record<string, number> = {};
  const olTotal:    Record<string, number> = {};
  const saoT:       Record<string, number> = {};
  players.forEach(p => { dfPtsTotal[p.id] = 0; dfTotal[p.id] = 0; olTotal[p.id] = 0; saoT[p.id] = 0; });

  const zero = () => Object.fromEntries(players.map(p => [p.id, 0]));

  for (const h of [...holes].sort((a, b) => a.number - b.number)) {
    const hs = byHole.get(h.id) || new Map();

    const dog = rules.enableDogFlight
      ? calcDogFlight(players, h, hs, stakes.dogFlight, rules.dfBirdieMult, rules.dfEagleMult)
      : { points: zero(), money: zero() };

    const { result: oly, awards: olyAwards } = rules.enableOlympic
      ? calcOlympic(players, h, hs)
      : { result: zero(), awards: [] as PerHoleResult["awards"] };

    const { result: sao, awards: saoAwards } = rules.enableSao
      ? calcSao(players, h, hs)
      : { result: zero(), awards: [] as PerHoleResult["awards"] };

    const awards = [...olyAwards, ...saoAwards];

    const total: Record<string, number> = {};
    for (const p of players) {
      total[p.id] = (oly[p.id] || 0) + (sao[p.id] || 0);
      dfPtsTotal[p.id] += dog.points[p.id] || 0;
      dfTotal[p.id]    += dog.money[p.id]  || 0;
      olTotal[p.id]    += oly[p.id] || 0;
      saoT[p.id]       += sao[p.id] || 0;
    }

    perHole.push({
      holeId: h.id, holeNumber: h.number, par: h.par, multiplier: h.multiplier,
      dogFlightPoints: dog.points, dogFlightMoney: dog.money,
      olympic: oly, sao, total, awards
    });
  }

  // ─── OLYMPIC EXTRA ────────────────────────────────────────────
  // Per player raw = (best single-value bundle) + (full-distinct-set bonus)
  //   K = N   (bundle / set size scales with player count)
  //   per-value bundle: for each Olympic value V in 1..N, bundle[V] = V × floor(count_V / N) × N
  //   bestBundle:       MAX across V — only the player's strongest repeat counts (not sum)
  //   full-set bonus:   if player has ≥1 of every value in 1..N, add 1+2+…+N
  // Olympic Special does NOT contribute. Only Olympic (olympic_points) input is used.
  // Net then settled zero-sum: net = raw × N − Σ rawsAll
  const N = players.length;
  const K = N;                                // bundle / set size = player count
  const sumOneToK = (K * (K + 1)) / 2;

  // Tally how many times each player got each integer Olympic value 1..K
  const counts: Record<string, Map<number, number>> = {};
  for (const p of players) counts[p.id] = new Map();
  for (const s of scores) {
    const v = Math.round(Number(s.olympic_points) || 0);
    if (v < 1 || v > K) continue;            // only positive in-range values count
    const m = counts[s.player_id];
    m.set(v, (m.get(v) || 0) + 1);
  }

  const olxRaw: Record<string, number> = {};
  const olxNet: Record<string, number> = {};
  for (const p of players) {
    const c = counts[p.id];
    // Per-value bundles — take the MAX single bundle, not the sum.
    // (Matches user's house rule: only the player's strongest repeat counts.)
    let bestBundle = 0;
    for (const [v, cnt] of c) {
      const b = v * Math.floor(cnt / K) * K;
      if (b > bestBundle) bestBundle = b;
    }
    // Full-set bonus: if player has ≥1 of every value 1..K, add 1+2+…+K (stacks on top of bundle).
    let hasFullSet = K > 0;
    for (let v = 1; v <= K; v++) if ((c.get(v) || 0) < 1) { hasFullSet = false; break; }
    olxRaw[p.id] = bestBundle + (hasFullSet ? sumOneToK : 0);
  }
  const sumOlxRaw = Object.values(olxRaw).reduce((a, b) => a + b, 0);
  for (const p of players) {
    olxNet[p.id] = olxRaw[p.id] * N - sumOlxRaw;   // zero-sum settlement
  }

  const grand:     Record<string, number> = {};
  const money:     Record<string, number> = {};
  const dfMoney:   Record<string, number> = {};
  const olMoney:   Record<string, number> = {};
  const olxMoney:  Record<string, number> = {};
  const saoMoney:  Record<string, number> = {};
  for (const p of players) {
    grand[p.id]     = olTotal[p.id] + olxNet[p.id] + saoT[p.id];
    dfMoney[p.id]   = dfTotal[p.id];
    olMoney[p.id]   = olTotal[p.id]  * stakes.olympic;
    olxMoney[p.id]  = olxNet[p.id]   * stakes.olympic;
    saoMoney[p.id]  = saoT[p.id]     * stakes.olympic;
    money[p.id]     = dfMoney[p.id] + olMoney[p.id] + olxMoney[p.id] + saoMoney[p.id];
  }

  return {
    perHole,
    dogFlightPointsTotal: dfPtsTotal,
    dogFlightTotal:    dfTotal,
    olympicTotal:      olTotal,
    olympicExtraTotal: olxNet,
    olympicExtraRaw:   olxRaw,
    saoTotal:          saoT,
    grandTotal:        grand,
    money,
    dogFlightMoney:    dfMoney,
    olympicMoney:      olMoney,
    olympicExtraMoney: olxMoney,
    saoMoney:          saoMoney
  };
}
