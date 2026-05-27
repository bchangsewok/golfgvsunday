import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const r = db.prepare("SELECT id FROM rounds WHERE code = ?").get(params.code.toUpperCase()) as any;
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  db.prepare("DELETE FROM rounds WHERE id = ?").run(r.id);  // cascades to players/holes/scores
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const body = await req.json();
  const r = db.prepare("SELECT id FROM rounds WHERE code = ?").get(params.code.toUpperCase()) as any;
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (body.status === "active" || body.status === "finished") {
    db.prepare("UPDATE rounds SET status = ? WHERE id = ?").run(body.status, r.id);
  }
  return NextResponse.json({ ok: true });
}
