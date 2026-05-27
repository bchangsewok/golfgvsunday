// Team Play scoring — parallel system, fully independent from Dog Flight / Olympic.
//
// Per hole:
//   • Take BEST (lowest) stroke from Team A and Team B (only players with strokes entered).
//   • If both teams' best are equal → tied → 0 points.
//   • Else, winning team's best score determines points:
//       eagle or better (≤ par−2) → eaglePoints   (default 10)
//       birdie (par−1)            → birdiePoints  (default 2)
//       otherwise (par or worse)  → parPoints     (default 1)
//   • Winning team gets +N team-points; losing team gets −N team-points.
//
// Money settlement:
//   teamMoney    = teamPointsTotal × team_play_stake (THB)
//   per-player   = teamMoney / (number of members in that team)
//
// Notes:
//   • Doesn't read hole.multiplier (kept intentionally — house rule).
//   • Doesn't touch Olympic / DF / SAO.
import type { Hole, Player, Score, TeamPlaySettings } from "./types";

export type TeamPlayPerHole = {
  holeId: string;
  holeNumber: number;
  par: number;
  bestA: number | null;        // lowest stroke on team A (null if no scores)
  bestB: number | null;
  winner: "A" | "B" | "tie" | "incomplete";
  pointsPerWinner: number;     // 0, 1, 2 or 10 (or whatever the rule set)
  kind: "par" | "birdie" | "eagle" | "tie" | "incomplete";
  // signed points for each TEAM on this hole (zero-sum across teams):
  teamPoints: { A: number; B: number };
};

export type TeamPlayTotals = {
  perHole: TeamPlayPerHole[];
  // Team-level points totals across all holes:
  teamPointsTotal: { A: number; B: number };
  // Team money (= team points × stake):
  teamMoneyTotal: { A: number; B: number };
  // Per-player money (split equally among team members):
  playerMoney: Record<string, number>;
  // Hole-counts won/tied/lost from each team's perspective (handy for the dashboard):
  holesWonByA: number; holesWonByB: number; holesTied: number;
  // Counts of how many holes were won by each kind:
  countByKind: { par: number; birdie: number; eagle: number };
};

export function calcTeamPlay(
  players: Player[],
  holes: Hole[],
  scores: Score[],
  rules: TeamPlaySettings,
  stake: number
): TeamPlayTotals {
  const teamA = players.filter(p => p.team === "A");
  const teamB = players.filter(p => p.team === "B");
  const nA = teamA.length, nB = teamB.length;

  const byHole = new Map<string, Map<string, Score>>();
  for (const s of scores) {
    if (!byHole.has(s.hole_id)) byHole.set(s.hole_id, new Map());
    byHole.get(s.hole_id)!.set(s.player_id, s);
  }

  const perHole: TeamPlayPerHole[] = [];
  let totalA = 0, totalB = 0;
  let holesWonByA = 0, holesWonByB = 0, holesTied = 0;
  const countByKind = { par: 0, birdie: 0, eagle: 0 };

  for (const h of [...holes].sort((a, b) => a.number - b.number)) {
    const hs = byHole.get(h.id) || new Map();
    const bestOf = (team: Player[]) => {
      let best: number | null = null;
      for (const p of team) {
        const s = hs.get(p.id);
        if (!s || s.strokes == null) continue;
        if (best == null || s.strokes < best) best = s.strokes;
      }
      return best;
    };
    const bestA = bestOf(teamA);
    const bestB = bestOf(teamB);

    let winner: TeamPlayPerHole["winner"] = "incomplete";
    let kind: TeamPlayPerHole["kind"] = "incomplete";
    let pts = 0;
    let teamPoints = { A: 0, B: 0 };

    if (bestA != null && bestB != null) {
      if (bestA === bestB) {
        winner = "tie"; kind = "tie"; holesTied++;
      } else {
        const winsAGameOnA = bestA < bestB;
        winner = winsAGameOnA ? "A" : "B";
        const winBest = winsAGameOnA ? bestA : bestB;
        const diff = winBest - h.par;
        if (diff <= -2)      { kind = "eagle";  pts = rules.eaglePoints;  }
        else if (diff === -1){ kind = "birdie"; pts = rules.birdiePoints; }
        else                 { kind = "par";    pts = rules.parPoints;    }
        teamPoints = winsAGameOnA ? { A: pts, B: -pts } : { A: -pts, B: pts };
        if (winsAGameOnA) holesWonByA++; else holesWonByB++;
        countByKind[kind]++;
      }
    }

    totalA += teamPoints.A;
    totalB += teamPoints.B;
    perHole.push({
      holeId: h.id, holeNumber: h.number, par: h.par,
      bestA, bestB, winner, pointsPerWinner: pts, kind, teamPoints
    });
  }

  const teamMoneyA = totalA * stake;
  const teamMoneyB = totalB * stake;

  // Distribute team money equally among that team's members.
  const playerMoney: Record<string, number> = {};
  for (const p of players) playerMoney[p.id] = 0;
  if (nA > 0) for (const p of teamA) playerMoney[p.id] = teamMoneyA / nA;
  if (nB > 0) for (const p of teamB) playerMoney[p.id] = teamMoneyB / nB;

  return {
    perHole,
    teamPointsTotal: { A: totalA, B: totalB },
    teamMoneyTotal:  { A: teamMoneyA, B: teamMoneyB },
    playerMoney,
    holesWonByA, holesWonByB, holesTied,
    countByKind
  };
}
