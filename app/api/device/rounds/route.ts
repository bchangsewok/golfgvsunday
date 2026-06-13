import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/device/rounds?device_id=XXX[&device_label=YYY]
//   Returns rounds visible to this device: matched by device_id OR by device_label
//   (so when the user shares the same label across multiple phones / browsers,
//   they see the union of all rounds those devices have touched).
//   Newest last_seen first, deduped per round_id (best row wins: admin > player > viewer).
export async function GET(req: NextRequest) {
  const device_id    = req.nextUrl.searchParams.get("device_id");
  const device_label = req.nextUrl.searchParams.get("device_label")?.trim();
  if (!device_id && !device_label) return NextResponse.json([], { status: 200 });

  const conds: string[] = [];
  const params: any[]   = [];
  if (device_id)    { conds.push("dr.device_id = ?");    params.push(device_id); }
  if (device_label) { conds.push("dr.device_label = ?"); params.push(device_label); }

  const rows = db.prepare(`
    SELECT dr.id, dr.device_id, dr.device_label, dr.round_id, dr.player_id,
           dr.is_admin, dr.admin_token, dr.first_seen, dr.last_seen,
           r.code, r.name, r.course_name, r.status, r.player_count,
           r.dog_flight_stake, r.olympic_stake, r.currency, r.created_at,
           p.name AS player_name, p.color AS player_color
    FROM device_rounds dr
    JOIN rounds r ON r.id = dr.round_id
    LEFT JOIN players p ON p.id = dr.player_id
    WHERE ${conds.join(" OR ")}
    ORDER BY dr.last_seen DESC
    LIMIT 100
  `).all(...params) as any[];

  // Dedupe per round: keep the "best" row (admin > player > viewer), then most recent.
  const byRound = new Map<string, any>();
  function score(r: any) {
    if (r.is_admin === 1) return 3;
    if (r.player_id)      return 2;
    return 1;
  }
  for (const r of rows) {
    const prev = byRound.get(r.round_id);
    if (!prev || score(r) > score(prev) || (score(r) === score(prev) && r.last_seen > prev.last_seen)) {
      byRound.set(r.round_id, r);
    }
  }
  const merged = Array.from(byRound.values()).sort((a, b) => b.last_seen.localeCompare(a.last_seen));
  return NextResponse.json(merged);
}

// POST /api/device/rounds  → upsert (device_id, round_id) and bump last_seen
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { device_id, device_label, round_id, player_id, is_admin, admin_token } = body || {};
  if (!device_id || !round_id) {
    return NextResponse.json({ error: "device_id and round_id required" }, { status: 400 });
  }

  // Verify round exists
  const round = db.prepare("SELECT id, admin_token FROM rounds WHERE id = ?").get(round_id) as any;
  if (!round) return NextResponse.json({ error: "round not found" }, { status: 404 });

  // Only accept admin_token / is_admin if it really matches
  const admin = (is_admin && admin_token && admin_token === round.admin_token) ? 1 : 0;
  const safeToken = admin ? admin_token : null;

  const existing = db.prepare(
    "SELECT id, is_admin, player_id, device_label FROM device_rounds WHERE device_id = ? AND round_id = ?"
  ).get(device_id, round_id) as any;

  if (existing) {
    // Don't downgrade admin → viewer; upgrade if new info says admin
    const newAdmin = admin || existing.is_admin;
    const newToken = newAdmin ? (safeToken || existing.admin_token) : null;
    const newPlayer = player_id ?? existing.player_id;
    const newLabel  = device_label ?? existing.device_label;
    db.prepare(`
      UPDATE device_rounds
      SET is_admin = ?, admin_token = ?, player_id = ?, device_label = ?,
          last_seen = datetime('now')
      WHERE id = ?
    `).run(newAdmin, newToken, newPlayer, newLabel, existing.id);
  } else {
    db.prepare(`
      INSERT INTO device_rounds (id, device_id, device_label, round_id, player_id, is_admin, admin_token)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), device_id, device_label ?? null, round_id, player_id ?? null, admin, safeToken);
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/device/rounds?device_id=XXX&round_id=YYY  → forget one round
export async function DELETE(req: NextRequest) {
  const device_id = req.nextUrl.searchParams.get("device_id");
  const round_id  = req.nextUrl.searchParams.get("round_id");
  if (!device_id || !round_id) {
    return NextResponse.json({ error: "device_id and round_id required" }, { status: 400 });
  }
  db.prepare("DELETE FROM device_rounds WHERE device_id = ? AND round_id = ?").run(device_id, round_id);
  return NextResponse.json({ ok: true });
}
