// Quick inspector — prints each player's olympic_points entries for a round.
// Usage: node scripts/inspect-round.js <ROUND_CODE>
const Database = require("better-sqlite3");
const path = require("path");

const code = (process.argv[2] || "").toUpperCase();
if (!code) { console.error("Pass round code: node scripts/inspect-round.js GV20260522R3"); process.exit(1); }

const db = new Database(path.join(process.cwd(), "data", "golfgvsunday.db"), { readonly: true });
const round = db.prepare("SELECT id, name, player_count FROM rounds WHERE code = ?").get(code);
if (!round) { console.error("Round not found:", code); process.exit(1); }

const players = db.prepare("SELECT id, name, seat FROM players WHERE round_id = ? ORDER BY seat").all(round.id);
const holes = db.prepare("SELECT id, number, par FROM holes WHERE round_id = ? ORDER BY number").all(round.id);
const scores = db.prepare("SELECT player_id, hole_id, olympic_points, olympic_special_points, sao_points FROM scores WHERE round_id = ?").all(round.id);

console.log(`Round ${code} · ${round.name} · ${players.length} players · ${holes.length} holes\n`);

const K = players.length;     // = N (player count)
for (const p of players) {
  console.log(`── ${p.name} (seat ${p.seat}) ──`);
  const myScores = scores.filter(s => s.player_id === p.id);
  const counts = new Map();
  let sumOly = 0, sumSp = 0, sumSao = 0;
  const rows = [];
  for (const h of holes) {
    const s = myScores.find(x => x.hole_id === h.id);
    if (!s) continue;
    const o = Number(s.olympic_points) || 0;
    const sp = Number(s.olympic_special_points) || 0;
    const sa = Number(s.sao_points) || 0;
    sumOly += o; sumSp += sp; sumSao += sa;
    if (o >= 1 && o <= K) counts.set(o, (counts.get(o) || 0) + 1);
    if (o || sp || sa) rows.push(`  H${h.number.toString().padStart(2)}: oly=${o}  sp=${sp}  sao=${sa}`);
  }
  rows.forEach(r => console.log(r));
  console.log(`  raw Σoly=${sumOly}  Σsp=${sumSp}  Σsao=${sumSao}`);
  console.log(`  olympic value counts (V→count) for V∈1..${K}:`,
    Array.from(counts.entries()).sort((a,b)=>a[0]-b[0]).map(([v,c])=>`${v}×${c}`).join("  ") || "(none)");

  let bestBundle = 0;
  const bundleLines = [];
  for (const [v, c] of counts) {
    const b = v * Math.floor(c / K) * K;
    bundleLines.push(`    V=${v}, count=${c} → ${v} × floor(${c}/${K}) × ${K} = ${b}`);
    if (b > bestBundle) bestBundle = b;
  }
  bundleLines.forEach(l => console.log(l));
  let hasFullSet = true;
  for (let v = 1; v <= K; v++) if ((counts.get(v) || 0) < 1) { hasFullSet = false; break; }
  const fullSet = hasFullSet ? (K * (K + 1)) / 2 : 0;
  console.log(`  best single bundle = ${bestBundle}`);
  console.log(`  full set 1..${K}? ${hasFullSet} → +${fullSet}`);
  console.log(`  → Olympic Extra raw = ${bestBundle} + ${fullSet} = ${bestBundle + fullSet}\n`);
}
