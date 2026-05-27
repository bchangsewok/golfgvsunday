// Seeds 4 demo rounds (3, 4, 5, 6 players) with random scores so you can verify the scoring engine.
// Run: node scripts/seed-demo-rounds.js
//
// Each round is deterministic (seeded PRNG) so re-running won't change values — but it WILL delete
// and recreate the rounds. Codes are DEMO3 / DEMO4 / DEMO5 / DEMO6.

const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const db = new Database(path.join(process.cwd(), "data", "golfgvsunday.db"));
db.pragma("foreign_keys = ON");

// Green Valley actual pars (par 72)
const PARS = [4,5,4,3,5,3,4,4,4,4,5,3,4,4,4,4,3,5];

const PLAYER_NAMES = ["Alex", "Bobby", "Cara", "Dom", "Eve", "Finn"];
const COLORS = ["#16a34a", "#0ea5e9", "#f59e0b", "#dc2626", "#a855f7", "#0891b2"];

// xorshift32 — deterministic, fast, no deps.
function mkRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

// Realistic-ish stroke around par: bell-curve-ish via mean(2 random) shifted.
function rollStrokes(rng, par) {
  // base mean = par + 0.5 (slightly worse than par on average)
  const r = (rng() + rng() + rng()) / 3;     // 0..1, bell-ish
  const offset = Math.round((r - 0.4) * 5);  // -2..+3
  const s = Math.max(1, Math.min(9, par + offset));
  return s;
}

function ensureCourse() {
  const row = db.prepare("SELECT id FROM courses WHERE name = ?").get("Green Valley Country Club");
  return row ? row.id : null;
}

function createRound({ code, name, playerCount, seed }) {
  // Wipe any existing round with this code
  const existing = db.prepare("SELECT id FROM rounds WHERE code = ?").get(code);
  if (existing) db.prepare("DELETE FROM rounds WHERE id = ?").run(existing.id);

  const rng = mkRng(seed);
  const roundId = crypto.randomUUID();
  const adminToken = crypto.randomUUID().replace(/-/g, "");
  const courseId = ensureCourse();

  // Round
  db.prepare(`
    INSERT INTO rounds (id, code, name, course_name, course_id, hole_count, player_count,
                        stake_per_point, dog_flight_stake, olympic_stake, currency, admin_token, settings, status)
    VALUES (?, ?, ?, 'Green Valley Country Club', ?, 18, ?, 10, 100, 10, 'THB', ?, '{}', 'active')
  `).run(roundId, code, name, courseId, playerCount, adminToken);

  // Holes — pars from Green Valley. Add ×2 multiplier on holes 9 and 18 (typical house rule).
  const holeIds = [];
  for (let i = 0; i < 18; i++) {
    const id = crypto.randomUUID();
    const mult = (i === 8 || i === 17) ? 2 : 1;
    db.prepare("INSERT INTO holes (id, round_id, number, par, multiplier) VALUES (?,?,?,?,?)")
      .run(id, roundId, i + 1, PARS[i], mult);
    holeIds.push(id);
  }

  // Players
  const playerIds = [];
  for (let i = 0; i < playerCount; i++) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO players (id, round_id, seat, name, color, player_token, handicap)
      VALUES (?,?,?,?,?,?,?)
    `).run(id, roundId, i + 1, PLAYER_NAMES[i], COLORS[i], crypto.randomUUID().replace(/-/g, ""), 0);
    playerIds.push(id);
  }

  // Scores — fill EVERY hole for EVERY player so calculations are complete.
  // Olympic values are biased to be 0..N with some clumping (so bundles / full sets occur).
  const insScore = db.prepare(`
    INSERT INTO scores (id, round_id, hole_id, player_id, strokes, olympic_points, olympic_special_points, sao_points, updated_by)
    VALUES (?,?,?,?,?,?,?,?, 'demo-seed')
  `);
  for (let h = 0; h < 18; h++) {
    for (let p = 0; p < playerCount; p++) {
      const strokes = rollStrokes(rng, PARS[h]);
      // olympic: 60% chance 0, otherwise 1..N (skewed toward middle)
      let oly = 0;
      if (rng() > 0.4) oly = 1 + Math.floor(rng() * playerCount);
      // olympic_special: 80% chance 0, otherwise a small ± value
      let olySp = 0;
      if (rng() > 0.8) {
        const r = rng();
        olySp = r < 0.5 ? Math.ceil(rng() * 5) : Math.ceil(rng() * 10) + 5;
        if (rng() < 0.15) olySp = -Math.ceil(rng() * 3);
      }
      // SAO: rare, ±3
      let sao = 0;
      if (rng() > 0.92) sao = rng() < 0.5 ? -3 : 3;
      insScore.run(crypto.randomUUID(), roundId, holeIds[h], playerIds[p],
                   strokes, oly, olySp, sao);
    }
  }
  return { code, adminToken, playerCount, name };
}

const seeds = [
  { code: "DEMO3", name: "Demo Round · 3 Players", playerCount: 3, seed: 0xA1B23001 },
  { code: "DEMO4", name: "Demo Round · 4 Players", playerCount: 4, seed: 0xA1B23002 },
  { code: "DEMO5", name: "Demo Round · 5 Players", playerCount: 5, seed: 0xA1B23003 },
  { code: "DEMO6", name: "Demo Round · 6 Players", playerCount: 6, seed: 0xA1B23004 }
];

const created = seeds.map(s => createRound(s));

console.log("\n4 demo rounds seeded:\n");
console.table(created.map(r => ({
  Code: r.code,
  Name: r.name,
  Players: r.playerCount,
  "Dashboard": `http://localhost:3002/round/${r.code}`,
  "Admin URL": `http://localhost:3002/round/${r.code}?admin=${r.adminToken}`
})));

console.log("\nPlayer detail (linked from scoreboard player names):");
console.log("  http://localhost:3002/round/DEMO3/player/<id>");
console.log("\nApp Admin (lists all rounds): http://localhost:3002/admin\n");
