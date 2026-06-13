import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/rounds  →  most recent rounds (for "browse previous rounds")
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 200);
  const rows = db.prepare(`
    SELECT id, code, name, course_name, hole_count, player_count, status,
           dog_flight_stake, olympic_stake, currency, created_at
    FROM rounds
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
  return NextResponse.json(rows);
}

type CreateInput = {
  code: string;
  name: string;
  course_name: string;
  course_id: string | null;
  hole_count: number;
  player_count: number;
  dog_flight_stake: number;
  olympic_stake: number;
  currency?: string;
  admin_token: string;
  pars: number[];
  players: { seat: number; name: string; color: string; player_token: string }[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateInput;
  const id = crypto.randomUUID();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO rounds (id, code, name, course_name, course_id, hole_count, player_count,
                          stake_per_point, dog_flight_stake, olympic_stake, currency, admin_token, settings)
      VALUES (@id, @code, @name, @course_name, @course_id, @hole_count, @player_count,
              @stake_per_point, @dog_flight_stake, @olympic_stake, @currency, @admin_token, '{}')
    `).run({
      id,
      code: body.code,
      name: body.name,
      course_name: body.course_name,
      course_id: body.course_id,
      hole_count: body.hole_count,
      player_count: body.player_count,
      stake_per_point: body.olympic_stake,   // legacy mirror
      dog_flight_stake: body.dog_flight_stake,
      olympic_stake: body.olympic_stake,
      currency: body.currency ?? "THB",
      admin_token: body.admin_token
    });
    const insHole = db.prepare(`INSERT INTO holes (id, round_id, number, par, multiplier) VALUES (?,?,?,?,1)`);
    for (let i = 0; i < body.hole_count; i++) {
      insHole.run(crypto.randomUUID(), id, i + 1, body.pars[i] ?? 4);
    }
    const insPlayer = db.prepare(`
      INSERT INTO players (id, round_id, seat, name, color, player_token) VALUES (?,?,?,?,?,?)
    `);
    for (const p of body.players) {
      insPlayer.run(crypto.randomUUID(), id, p.seat, p.name, p.color, p.player_token);
    }
  });

  try {
    tx();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "create failed" }, { status: 400 });
  }
  return NextResponse.json({ id, code: body.code, admin_token: body.admin_token });
}
