import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitRoundEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const hole = db.prepare("SELECT * FROM holes WHERE id = ?").get(params.id) as any;
  if (!hole) return NextResponse.json({ error: "not found" }, { status: 404 });
  const allowed = ["par", "multiplier"];
  const sets: string[] = []; const vals: any = {};
  for (const k of allowed) if (k in body) { sets.push(`${k} = @${k}`); vals[k] = body[k]; }
  if (!sets.length) return NextResponse.json(hole);
  vals.id = params.id;
  db.prepare(`UPDATE holes SET ${sets.join(", ")} WHERE id = @id`).run(vals);
  const updated = db.prepare("SELECT * FROM holes WHERE id = ?").get(params.id);
  emitRoundEvent(hole.round_id, { table: "holes", type: "UPDATE", row: updated });
  return NextResponse.json(updated);
}
