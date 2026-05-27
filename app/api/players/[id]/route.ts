import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitRoundEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const player = db.prepare("SELECT * FROM players WHERE id = ?").get(params.id) as any;
  if (!player) return NextResponse.json({ error: "not found" }, { status: 404 });
  const allowed = ["name", "color", "handicap", "plays_dog_flight", "applies_multiplier", "food_expenses", "team"];
  const sets: string[] = []; const vals: any = {};
  for (const k of allowed) if (k in body) { sets.push(`${k} = @${k}`); vals[k] = body[k]; }
  if (!sets.length) return NextResponse.json(player);
  vals.id = params.id;
  db.prepare(`UPDATE players SET ${sets.join(", ")} WHERE id = @id`).run(vals);
  const updated = db.prepare("SELECT * FROM players WHERE id = ?").get(params.id);
  emitRoundEvent(player.round_id, { table: "players", type: "UPDATE", row: updated });
  return NextResponse.json(updated);
}
