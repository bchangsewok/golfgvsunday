import { NextResponse } from "next/server";
import { db, parseRound } from "@/lib/db";

export const dynamic = "force-dynamic";

// Summary of every round in the DB.
export async function GET() {
  const rows = db.prepare(`
    SELECT r.id, r.code, r.name, r.course_name, r.hole_count, r.player_count,
           r.dog_flight_stake, r.olympic_stake, r.currency, r.status, r.created_at, r.settings,
           r.admin_token,
           (SELECT COUNT(*) FROM players p WHERE p.round_id = r.id) AS players_count,
           (SELECT COUNT(*) FROM scores s WHERE s.round_id = r.id AND s.strokes IS NOT NULL) AS scores_count,
           (SELECT COUNT(DISTINCT h.id) FROM holes h WHERE h.round_id = r.id) AS total_holes
    FROM rounds r
    ORDER BY r.created_at DESC
  `).all() as any[];
  return NextResponse.json(rows.map(parseRound));
}
