import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitRoundEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Upsert by (hole_id, player_id). Only fields present in the body are written;
// missing fields preserve the existing value.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { round_id, hole_id, player_id, updated_by } = body;
  if (!round_id || !hole_id || !player_id) {
    return NextResponse.json({ error: "missing keys" }, { status: 400 });
  }
  const existing = db.prepare("SELECT * FROM scores WHERE hole_id = ? AND player_id = ?")
    .get(hole_id, player_id) as any;

  const strokes = "strokes" in body ? body.strokes : (existing?.strokes ?? null);
  const dist    = "on_green_distance_m" in body ? body.on_green_distance_m : (existing?.on_green_distance_m ?? null);
  const oly     = "olympic_points" in body ? clamp(Number(body.olympic_points) || 0, 0, 9) : (existing?.olympic_points ?? 0);
  const olySp   = "olympic_special_points" in body ? clamp(Number(body.olympic_special_points) || 0, -3, 15) : (existing?.olympic_special_points ?? 0);
  const sao     = "sao_points" in body ? Number(body.sao_points) || 0 : (existing?.sao_points ?? 0);

  if (existing) {
    db.prepare(`
      UPDATE scores SET strokes = ?, on_green_distance_m = ?, olympic_points = ?, olympic_special_points = ?,
                        sao_points = ?, updated_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(strokes ?? null, dist ?? null, oly, olySp, sao, updated_by ?? null, existing.id);
  } else {
    db.prepare(`
      INSERT INTO scores (id, round_id, hole_id, player_id, strokes, on_green_distance_m,
                          olympic_points, olympic_special_points, sao_points, updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(crypto.randomUUID(), round_id, hole_id, player_id, strokes ?? null, dist ?? null, oly, olySp, sao, updated_by ?? null);
  }
  const row = db.prepare("SELECT * FROM scores WHERE hole_id = ? AND player_id = ?")
    .get(hole_id, player_id);
  emitRoundEvent(round_id, { table: "scores", type: existing ? "UPDATE" : "INSERT", row });
  return NextResponse.json(row);
}
