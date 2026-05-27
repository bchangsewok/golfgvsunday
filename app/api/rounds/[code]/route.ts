import { NextRequest, NextResponse } from "next/server";
import { db, parseRound } from "@/lib/db";
import { emitRoundEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const round = db.prepare("SELECT * FROM rounds WHERE code = ?").get(params.code.toUpperCase());
  if (!round) return NextResponse.json({ error: "not found" }, { status: 404 });
  const r = parseRound(round) as any;
  const players = db.prepare("SELECT * FROM players WHERE round_id = ? ORDER BY seat").all(r.id);
  const holes   = db.prepare("SELECT * FROM holes   WHERE round_id = ? ORDER BY number").all(r.id);
  const scores  = db.prepare("SELECT * FROM scores  WHERE round_id = ?").all(r.id);
  return NextResponse.json({ round: r, players, holes, scores });
}

export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const body = await req.json();
  const round = db.prepare("SELECT * FROM rounds WHERE code = ?").get(params.code.toUpperCase()) as any;
  if (!round) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (body.admin_token !== round.admin_token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const allowed = ["name", "course_name", "stake_per_point", "dog_flight_stake", "olympic_stake",
                   "currency", "player_count", "status", "settings",
                   "team_play_enabled", "team_play_stake"];
  const sets: string[] = [];
  const vals: any = {};
  for (const k of allowed) {
    if (k in body) {
      sets.push(`${k} = @${k}`);
      vals[k] = k === "settings" ? JSON.stringify(body[k]) : body[k];
    }
  }
  if (!sets.length) return NextResponse.json({ ok: true });
  vals.id = round.id;
  db.prepare(`UPDATE rounds SET ${sets.join(", ")} WHERE id = @id`).run(vals);
  const updated = parseRound(db.prepare("SELECT * FROM rounds WHERE id = ?").get(round.id));
  emitRoundEvent(round.id, { table: "rounds", type: "UPDATE", row: updated });
  return NextResponse.json(updated);
}
