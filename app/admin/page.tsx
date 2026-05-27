"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Trash2, ExternalLink, RefreshCw, CheckCircle2, PlayCircle, Search, Users, MapPin, Copy, Edit3 } from "lucide-react";

type RoundRow = {
  id: string;
  code: string;
  name: string;
  course_name: string | null;
  hole_count: number;
  player_count: number;
  dog_flight_stake: number;
  olympic_stake: number;
  currency: string;
  status: "active" | "finished";
  created_at: string;
  admin_token: string;
  players_count: number;
  scores_count: number;
  total_holes: number;
};

export default function AppAdmin() {
  const [rounds, setRounds] = useState<RoundRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await fetch("/api/admin/rounds");
      if (!res.ok) throw new Error("Failed to load");
      setRounds(await res.json());
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    }
  }
  useEffect(() => { load(); }, []);

  async function deleteRound(code: string) {
    if (!confirm(`Delete round ${code}? This cannot be undone.`)) return;
    setWorking(code);
    await fetch(`/api/admin/rounds/${code}`, { method: "DELETE" });
    setWorking(null);
    load();
  }
  async function setStatus(code: string, status: "active" | "finished") {
    setWorking(code);
    await fetch(`/api/admin/rounds/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    setWorking(null);
    load();
  }

  const filtered = (rounds || []).filter(r => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return r.code.toLowerCase().includes(q)
        || r.name.toLowerCase().includes(q)
        || (r.course_name || "").toLowerCase().includes(q);
  });

  const stats = rounds ? {
    total: rounds.length,
    active: rounds.filter(r => r.status === "active").length,
    finished: rounds.filter(r => r.status === "finished").length
  } : { total: 0, active: 0, finished: 0 };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Crown className="w-6 h-6 text-sand-500" /> App Admin
          <span className="chip bg-white/5 text-white/50 border border-white/10 text-[10px]">manages all rounds</span>
        </h1>
        <button onClick={load} className="btn-ghost">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total rounds" value={stats.total} />
        <Stat label="Active"       value={stats.active}   color="text-fairway-500" />
        <Stat label="Finished"     value={stats.finished} color="text-white/60" />
      </div>

      <div className="card p-3">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Search className="w-4 h-4 text-white/40" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by code, name, or course…"
            className="input py-2" />
        </div>

        {err && <p className="text-red-400 text-sm p-3">{err}</p>}
        {!rounds && !err && <p className="text-white/40 text-sm p-6 text-center">Loading…</p>}
        {rounds && filtered.length === 0 && (
          <p className="text-white/40 text-sm p-6 text-center">No rounds yet — create one from the home page.</p>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="text-white/40 text-xs">
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 px-2">Code</th>
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Course</th>
                  <th className="text-center py-2 px-2">Players</th>
                  <th className="text-center py-2 px-2">Progress</th>
                  <th className="text-right py-2 px-2">Stakes</th>
                  <th className="text-center py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Created</th>
                  <th className="text-right py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const expectedScores = r.total_holes * r.player_count;
                  const pct = expectedScores ? Math.round((r.scores_count / expectedScores) * 100) : 0;
                  return (
                    <tr key={r.code} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 px-2 font-mono font-bold text-fairway-500">{r.code}</td>
                      <td className="py-2 px-2 text-white">{r.name}</td>
                      <td className="py-2 px-2 text-white/70">
                        {r.course_name && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-white/40" />{r.course_name}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center text-white/70">
                        <Users className="w-3 h-3 inline mr-1 text-white/40" />{r.players_count}/{r.player_count}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-white/70 tabular-nums">{pct}%</span>
                        <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden inline-block ml-2 align-middle">
                          <div className="h-full bg-fairway-500" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-white/60 tabular-nums text-xs">
                        DF {r.dog_flight_stake} · Oly {r.olympic_stake}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {r.status === "active"
                          ? <span className="chip bg-fairway-500/20 text-fairway-500 border border-fairway-500/30">● live</span>
                          : <span className="chip bg-white/5 text-white/60 border border-white/10">✓ done</span>}
                      </td>
                      <td className="py-2 px-2 text-white/40 text-xs">{new Date(r.created_at + "Z").toLocaleString()}</td>
                      <td className="py-2 px-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link href={`/round/${r.code}?admin=${r.admin_token}`}
                                className="btn-ghost py-1 px-2 text-xs"
                                title="Open dashboard as round-admin">
                            <ExternalLink className="w-3 h-3 text-sand-500" />
                          </Link>
                          <Link href={`/round/${r.code}/admin?admin=${r.admin_token}`}
                                className="btn-ghost py-1 px-2 text-xs"
                                title="Round settings (Local Rules / Players)">
                            <Edit3 className="w-3 h-3 text-fairway-500" />
                          </Link>
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/round/${r.code}?admin=${r.admin_token}`;
                              navigator.clipboard.writeText(url);
                            }}
                            className="btn-ghost py-1 px-2 text-xs"
                            title="Copy admin URL">
                            <Copy className="w-3 h-3 text-white/60" />
                          </button>
                          <button
                            onClick={() => setStatus(r.code, r.status === "active" ? "finished" : "active")}
                            className="btn-ghost py-1 px-2 text-xs"
                            disabled={working === r.code}
                            title={r.status === "active" ? "Mark finished" : "Re-open"}>
                            {r.status === "active"
                              ? <CheckCircle2 className="w-3 h-3 text-fairway-500" />
                              : <PlayCircle className="w-3 h-3 text-sand-500" />}
                          </button>
                          <button
                            onClick={() => deleteRound(r.code)}
                            className="btn-ghost py-1 px-2 text-xs hover:bg-red-500/20 hover:border-red-500/40"
                            disabled={working === r.code}
                            title="Delete round">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-white/30 text-xs text-center">
        Local SQLite at <code className="text-white/50">data/golfgvsunday.db</code> · changes are immediate and irreversible.
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="card p-3">
      <div className="text-white/40 text-xs">{label}</div>
      <div className={`text-2xl font-bold ${color || "text-white"}`}>{value}</div>
    </div>
  );
}
