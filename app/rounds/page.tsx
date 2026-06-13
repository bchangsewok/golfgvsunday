"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Users, ArrowLeft, Loader2, Crown } from "lucide-react";
import { fetchDeviceRounds, getDeviceLabel, type DeviceRound } from "@/lib/device";

type Filter = "all" | "active" | "finished";

export default function MyRoundsPage() {
  const [rounds, setRounds] = useState<DeviceRound[] | null>(null);
  const [label,  setLabel]  = useState<string>("");
  const [error,  setError]  = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query,  setQuery]  = useState("");

  useEffect(() => {
    setLabel(getDeviceLabel());
    fetchDeviceRounds()
      .then(setRounds)
      .catch(e => setError(e?.message || "Failed to load rounds"));
  }, []);

  // Only rounds where THIS device (or a same-labeled device) was the creator.
  const mine = useMemo(() => (rounds ?? []).filter(r => r.is_admin === 1), [rounds]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine.filter(r => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.course_name || "").toLowerCase().includes(q)
      );
    });
  }, [mine, filter, query]);

  const counts = useMemo(() => ({
    all:      mine.length,
    active:   mine.filter(r => r.status === "active").length,
    finished: mine.filter(r => r.status === "finished").length
  }), [mine]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/" className="btn-ghost text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Crown className="w-5 h-5 text-sand-500" /> My rounds
        </h1>
        {rounds && (
          <span className="text-white/40 text-sm">
            · {mine.length} created{label ? <> by <b className="text-white/70">{label}</b></> : ""}
          </span>
        )}
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
        {!label && (
          <p className="text-white/40 text-xs">
            Tip: name this device (Rename button on the home page) so rounds you create from other devices using the same name also appear here.
          </p>
        )}
      </div>

      {error && <div className="card p-4 text-red-400 text-sm">{error}</div>}

      {!rounds && !error && (
        <div className="card p-8 flex items-center justify-center text-white/50">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {rounds && mine.length === 0 && (
        <div className="card p-8 text-center text-white/40 text-sm">
          You haven't created any rounds yet. Use <Link href="/" className="text-fairway-500 underline">New round</Link> on the home page.
        </div>
      )}

      {rounds && mine.length > 0 && visible.length === 0 && (
        <div className="card p-8 text-center text-white/40 text-sm">No rounds match your filter.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map(r => {
          const href = `/round/${r.code}${r.admin_token ? `?admin=${r.admin_token}` : ""}`;
          return (
            <Link
              key={r.id}
              href={href}
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
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{r.player_count}p</span>
                <span className="text-white/30">{new Date(r.created_at + "Z").toLocaleDateString()}</span>
                {r.device_label && r.device_label !== label && (
                  <span className="text-white/30">· from <span className="text-white/50">{r.device_label}</span></span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
