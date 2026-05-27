// Server-only: SQLite via better-sqlite3.
// File lives at <project>/data/golfgvsunday.db, auto-initialized on first use.
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const SEED_COURSES: Array<{ name: string; location: string; pars: number[] }> = [
  // Green Valley actual pars from the group's scorecard (par 72).
  { name: "Green Valley Country Club", location: "Bangna, Thailand",         pars: [4,5,4,3,5,3,4,4,4,4,5,3,4,4,4,4,3,5] },
  { name: "Alpine Golf Club",          location: "Pathum Thani, Thailand",   pars: [4,5,3,4,4,3,5,4,4,4,4,3,5,4,3,4,5,4] },
  { name: "Thai Country Club",         location: "Chachoengsao, Thailand",   pars: [4,3,4,5,4,4,3,5,4,4,5,3,4,4,4,3,5,4] },
  { name: "Muang Kaew Golf Course",    location: "Bangna, Thailand",         pars: [4,4,3,5,4,3,5,4,4,4,3,4,5,4,4,3,5,4] },
  { name: "Summit Windmill",           location: "Bangna, Thailand",         pars: [4,5,4,3,4,4,3,5,4,4,4,5,3,4,4,5,3,4] },
  { name: "Bangpoo Country Club",      location: "Samut Prakan, Thailand",   pars: [4,3,5,4,4,4,3,5,4,4,5,3,4,4,4,3,5,4] },
  { name: "Lotus Valley",              location: "Lam Luk Ka, Thailand",     pars: [4,4,5,3,4,4,5,3,4,4,3,5,4,4,3,4,5,4] },
  { name: "Subhapruek Golf Club",      location: "Bang Bo, Thailand",        pars: [4,4,3,5,4,3,4,5,4,4,5,3,4,4,4,3,5,4] }
];

declare global {
  // eslint-disable-next-line no-var
  var __golf_db: Database.Database | undefined;
}

function hasColumn(d: Database.Database, table: string, col: string): boolean {
  try {
    const rows = d.prepare(`PRAGMA table_info(${table})`).all() as any[];
    return rows.some(r => r.name === col);
  } catch { return false; }
}

function migrate(d: Database.Database) {
  // Only runs if the table already exists (older DB). On fresh DBs, columns are in CREATE.
  try { d.prepare("SELECT 1 FROM rounds LIMIT 1").get(); } catch { return; }
  if (!hasColumn(d, "rounds", "dog_flight_stake"))
    d.exec("ALTER TABLE rounds ADD COLUMN dog_flight_stake REAL NOT NULL DEFAULT 100");
  if (!hasColumn(d, "rounds", "olympic_stake"))
    d.exec("ALTER TABLE rounds ADD COLUMN olympic_stake REAL NOT NULL DEFAULT 10");
  if (!hasColumn(d, "scores", "olympic_points"))
    d.exec("ALTER TABLE scores ADD COLUMN olympic_points REAL NOT NULL DEFAULT 0");
  if (!hasColumn(d, "scores", "sao_points"))
    d.exec("ALTER TABLE scores ADD COLUMN sao_points REAL NOT NULL DEFAULT 0");
  if (!hasColumn(d, "scores", "olympic_special_points"))
    d.exec("ALTER TABLE scores ADD COLUMN olympic_special_points REAL NOT NULL DEFAULT 0");
  if (!hasColumn(d, "players", "plays_dog_flight"))
    d.exec("ALTER TABLE players ADD COLUMN plays_dog_flight INTEGER NOT NULL DEFAULT 1");
  if (!hasColumn(d, "players", "applies_multiplier"))
    d.exec("ALTER TABLE players ADD COLUMN applies_multiplier INTEGER NOT NULL DEFAULT 1");
  if (!hasColumn(d, "players", "food_expenses"))
    d.exec("ALTER TABLE players ADD COLUMN food_expenses REAL NOT NULL DEFAULT 0");
  if (!hasColumn(d, "players", "team"))
    d.exec("ALTER TABLE players ADD COLUMN team TEXT");                     // null | 'A' | 'B'
  if (!hasColumn(d, "rounds", "team_play_enabled"))
    d.exec("ALTER TABLE rounds ADD COLUMN team_play_enabled INTEGER NOT NULL DEFAULT 0");
  if (!hasColumn(d, "rounds", "team_play_stake"))
    d.exec("ALTER TABLE rounds ADD COLUMN team_play_stake REAL NOT NULL DEFAULT 100");
}

function open(): Database.Database {
  const DATA_DIR = path.join(process.cwd(), "data");
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const d = new Database(path.join(DATA_DIR, "golfgvsunday.db"));
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");

  // Run any pending column-add migrations BEFORE the CREATE statements (so they're a no-op on fresh DBs).
  migrate(d);

  d.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      location TEXT,
      hole_count INTEGER NOT NULL DEFAULT 18,
      pars TEXT NOT NULL,
      is_seeded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT 'Sunday Round',
      course_name TEXT,
      course_id TEXT REFERENCES courses(id),
      hole_count INTEGER NOT NULL DEFAULT 18,
      player_count INTEGER NOT NULL DEFAULT 4,
      stake_per_point REAL NOT NULL DEFAULT 10,
      dog_flight_stake REAL NOT NULL DEFAULT 100,
      olympic_stake REAL NOT NULL DEFAULT 10,
      currency TEXT NOT NULL DEFAULT 'THB',
      admin_token TEXT NOT NULL,
      settings TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      team_play_enabled INTEGER NOT NULL DEFAULT 0,
      team_play_stake REAL NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      seat INTEGER NOT NULL,
      color TEXT NOT NULL DEFAULT '#16a34a',
      handicap REAL NOT NULL DEFAULT 0,
      player_token TEXT NOT NULL,
      plays_dog_flight INTEGER NOT NULL DEFAULT 1,
      applies_multiplier INTEGER NOT NULL DEFAULT 1,
      food_expenses REAL NOT NULL DEFAULT 0,
      team TEXT,
      UNIQUE (round_id, seat)
    );
    CREATE TABLE IF NOT EXISTS holes (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      par INTEGER NOT NULL DEFAULT 4,
      multiplier INTEGER NOT NULL DEFAULT 1,
      UNIQUE (round_id, number)
    );
    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      hole_id TEXT NOT NULL REFERENCES holes(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      strokes INTEGER,
      on_green_distance_m REAL,
      olympic_points REAL NOT NULL DEFAULT 0,
      olympic_special_points REAL NOT NULL DEFAULT 0,
      sao_points REAL NOT NULL DEFAULT 0,
      updated_by TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (hole_id, player_id)
    );
    CREATE INDEX IF NOT EXISTS scores_round_idx  ON scores(round_id);
    CREATE INDEX IF NOT EXISTS holes_round_idx   ON holes(round_id);
    CREATE INDEX IF NOT EXISTS players_round_idx ON players(round_id);
  `);

  // Upsert seeded courses: insert if new, refresh pars/location if data drifts.
  const findByName = d.prepare("SELECT id FROM courses WHERE name = ?");
  const insertCourse = d.prepare(
    `INSERT INTO courses (id, name, location, hole_count, pars, is_seeded)
     VALUES (?, ?, ?, 18, ?, 1)`
  );
  const updateCourse = d.prepare(
    `UPDATE courses SET location = ?, hole_count = 18, pars = ?, is_seeded = 1 WHERE id = ?`
  );
  for (const c of SEED_COURSES) {
    const existing = findByName.get(c.name) as any;
    if (existing) updateCourse.run(c.location, JSON.stringify(c.pars), existing.id);
    else insertCourse.run(crypto.randomUUID(), c.name, c.location, JSON.stringify(c.pars));
  }
  return d;
}

export function getDb(): Database.Database {
  if (!global.__golf_db) global.__golf_db = open();
  return global.__golf_db;
}

// Backwards-compat: lazy property access via Proxy so existing `db.prepare(...)` calls work.
export const db: Database.Database = new Proxy({} as Database.Database, {
  get(_t, prop) {
    const d = getDb() as any;
    const v = d[prop];
    return typeof v === "function" ? v.bind(d) : v;
  }
});

export function parseCourse(r: any) {
  if (!r) return r;
  const pars = JSON.parse(r.pars);
  return { ...r, pars, total_par: pars.reduce((a: number, b: number) => a + b, 0), is_seeded: !!r.is_seeded };
}
export function parseRound(r: any) {
  return r && { ...r, settings: r.settings ? JSON.parse(r.settings) : {} };
}
