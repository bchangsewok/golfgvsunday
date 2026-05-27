import { NextResponse } from "next/server";
import { db, parseCourse } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db.prepare("SELECT * FROM courses ORDER BY name").all();
  return NextResponse.json(rows.map(parseCourse));
}
