"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Users, ArrowLeft, Loader2 } from "lucide-react";
import { api, type RoundSummary } from "@/lib/api";
import { trackRoundAccess } from "@/lib/device";

type Filter = "all" | "active" | "finished";

export default function AllRoundsPage() {
  const [rounds, setRounds] = useState<RoundSummary[] | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery]   = useState("");

  useEffect(() => {
    api.listRounds(200)
      .then(setRounds)
      .catch(e => setError(e?.message || "Failed to load rounds"));
  }, []);

  const visible = useMemo(() => {
    if (!rounds) return [];
    const q = query.trim().toLowerCase();
    return rounds.filter(r => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.course_name || "").toLowerCase().includes(q)
      );
    });
  }, [rounds, filter, query]);

  const counts = useMemo(() => {
    if (!rounds) return { all: 0, active: 0, finished: 0 };
    return {
      all: rounds.length,
      active: rounds.filter(r => r.status === "active").length,
      finished: rounds.filter(r => r.status === "finished").length
    };
  }, [rounds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="btn-ghost text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold text-white">All rounds</h1>
        {rounds && <span className="text-white/40 text-sm">· {rounds.length} total</span>}
      </div>

      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "active", "finished"] as const).map(k => (
            <button key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                filter === k
                  ? "bg-fairway-500 text-white"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}>
              {k === "all" ? "All" : k === "active" ? "● Live" : "✓ Finished"}
              <span className="ml-1 opacity-60">{counts[k]}</span>
            </button>
          ))}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              className="input pl-9"
              placeholder="Search code, name, or course…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="card p-4 text-red-400 text-sm">{error}</div>}

      {!rounds && !error && (
        <div className="card p-8 flex items-center justify-center text-white/50">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading rounds…
        </div>
      )}

      {rounds && visible.length === 0 && (
        <div className="card p-8 text-center text-white/40 text-sm">
          {rounds.length === 0 ? "No rounds yet. Create one from the home page." : "No rounds match your filter."}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map(r => (
          <Link
            key={r.id}
            href={`/round/${r.code}`}
            onClick={() => { trackRoundAccess({ round_id: r.id }); }}
            className="card p-4 hover:bg-white/10 transition block">
            <div className="flex items-center justify-between mb-2">
              <code className="text-fairway-500 font-bold text-base tracking-wider">{r.code}</code>
              <span className={`text-xs font-semibold ${r.status === "active" ? "text-fairway-500" : "text-white/40"}`}>
                {r.status === "active" ? "● live" : "✓ finished"}
              </span>
            </div>
            <div className="text-white font-semibold truncate">{r.name}</div>
            <div className="text-white/50 text-xs flex items-center gap-1 truncate mt-1">
              {r.course_name && <><MapPin className="w-3 h-3 flex-shrink-0" />{r.course_name}</>}
            </div>
            <div className="text-white/40 text-xs flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{r.player_count}p · {r.hole_count}h</span>
              <span className="text-white/30">{new Date(r.created_at + "Z").toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
