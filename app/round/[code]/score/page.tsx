"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useRound } from "@/lib/useRound";
import { api, safeCall } from "@/lib/api";
import { trackRoundAccess } from "@/lib/device";
import { mergedSettings } from "@/lib/defaults";
import { ChevronLeft, ChevronRight, Check, Edit2, Crown } from "lucide-react";
import { entryButtonsFor, termFor } from "@/lib/golfTerms";
import Link from "next/link";

export default function ScoreEntry({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const search = useSearchParams();
  const router = useRouter();
  const adminToken = search.get("admin") || "";
  const { round, players, holes, scores, loading, err } = useRound(code);

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [holeIdx, setHoleIdx] = useState(0);

  // Restore previous selection OR honor ?player=ID query param (preferred — overrides saved).
  useEffect(() => {
    if (!round) return;
    const queryPlayer = search.get("player");
    if (queryPlayer && players.some(p => p.id === queryPlayer)) {
      setMyPlayerId(queryPlayer);
      localStorage.setItem(`gv:${round.code}:player`, queryPlayer);
      return;
    }
    const saved = localStorage.getItem(`gv:${round.code}:player`);
    if (saved && players.some(p => p.id === saved)) setMyPlayerId(saved);
  }, [round, players, search]);

  function pickSeat(id: string) {
    setMyPlayerId(id);
    if (round) {
      localStorage.setItem(`gv:${round.code}:player`, id);
      // Register this device as that player on this round
      trackRoundAccess({ round_id: round.id, player_id: id });
    }
  }

  if (loading) return <div className="text-white/60 text-center py-20">Loading…</div>;
  if (err || !round) return <div className="text-red-400 text-center py-20">{err || "Not found"}</div>;

  const isAdmin = adminToken === round.admin_token;
  const sortedHoles = [...holes].sort((a, b) => a.number - b.number);
  const hole = sortedHoles[holeIdx];

  // Seat picker if no player selected
  if (!myPlayerId && !isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Who are you?</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {players.map(p => (
            <button key={p.id} onClick={() => pickSeat(p.id)}
              className="card p-4 flex items-center gap-3 hover:bg-white/10 transition text-left">
              <div className="w-12 h-12 rounded-full grid place-items-center text-white font-bold text-lg shadow"
                   style={{ background: p.color }}>{p.name[0]?.toUpperCase()}</div>
              <div>
                <div className="text-white font-semibold">{p.name}</div>
                <div className="text-white/40 text-xs">Seat {p.seat}</div>
              </div>
            </button>
          ))}
        </div>
        <Link href={`/round/${code}`} className="btn-ghost w-full justify-center">Back to dashboard</Link>
      </div>
    );
  }

  const me = players.find(p => p.id === myPlayerId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/round/${code}${isAdmin ? `?admin=${adminToken}` : ""}`} className="btn-ghost">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="text-right">
          {isAdmin ? (
            <span className="chip bg-sand-500/20 text-sand-500 border border-sand-500/30">
              <Crown className="w-3 h-3" /> Admin
            </span>
          ) : me && (
            <button onClick={() => { setRenaming(true); setNewName(me.name); }}
              className="flex items-center gap-1 text-white/70 text-sm">
              <span className="w-3 h-3 rounded-full" style={{ background: me.color }} />
              {me.name} <Edit2 className="w-3 h-3 opacity-50" />
            </button>
          )}
        </div>
      </div>

      {renaming && me && (
        <div className="card p-3 flex gap-2">
          <input className="input" value={newName} onChange={e => setNewName(e.target.value)} />
          <button className="btn-primary" onClick={async () => {
            await safeCall(api.patchPlayer(me.id, { name: newName }));
            setRenaming(false);
          }}>Save</button>
        </div>
      )}

      {/* Hole stepper */}
      <div className="flex items-center justify-between">
        <button onClick={() => setHoleIdx(i => Math.max(0, i - 1))} disabled={holeIdx === 0} className="btn-ghost">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <div className="text-white/40 text-xs">Hole</div>
          <div className="text-white text-4xl font-extrabold">{hole.number}</div>
          <div className="text-white/60 text-xs">Par {hole.par} · ×{hole.multiplier}</div>
        </div>
        <button onClick={() => setHoleIdx(i => Math.min(sortedHoles.length - 1, i + 1))}
          disabled={holeIdx === sortedHoles.length - 1} className="btn-ghost">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isAdmin ? (
        <AdminHoleEntry hole={hole} players={players} scores={scores} round={round} />
      ) : me && (
        <PlayerHoleEntry hole={hole} player={me} scores={scores} round={round} />
      )}

      <div className="grid grid-cols-9 gap-1 pt-2">
        {sortedHoles.map((h, i) => {
          const filled = scores.filter(s => s.hole_id === h.id && s.strokes != null).length;
          const done = filled >= players.length;
          return (
            <button key={h.id} onClick={() => setHoleIdx(i)}
              className={`aspect-square rounded-lg text-xs font-bold transition
                ${i === holeIdx ? "bg-fairway-500 text-white" : done ? "bg-fairway-500/20 text-fairway-500" : "bg-white/5 text-white/40"}`}>
              {h.number}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlayerHoleEntry({ hole, player, scores, round }: any) {
  const cfg = mergedSettings(round.settings);
  const maxStrokes = 9;                       // hard cap per house rules
  const buckets = cfg.distanceBuckets[round.player_count] || cfg.distanceBuckets[4];

  const myScore = scores.find((s: any) => s.hole_id === hole.id && s.player_id === player.id);
  const [strokes, setStrokes] = useState<number | null>(myScore?.strokes ?? null);
  const [distance, setDistance] = useState<number | null>(myScore?.on_green_distance_m ?? null);
  const [olympic, setOlympic] = useState<number>(myScore?.olympic_points ?? 0);
  const [olympicSp, setOlympicSp] = useState<number>(myScore?.olympic_special_points ?? 0);
  const [sao, setSao] = useState<number>(myScore?.sao_points ?? 0);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");

  const saoUnit = cfg.localRules.saoPoints;
  const olyMax  = round.player_count;     // Olympic Maximum = number of players

  useEffect(() => {
    setStrokes(myScore?.strokes ?? null);
    setDistance(myScore?.on_green_distance_m ?? null);
    setOlympic(myScore?.olympic_points ?? 0);
    setOlympicSp(myScore?.olympic_special_points ?? 0);
    setSao(myScore?.sao_points ?? 0);
  }, [myScore?.id, hole.id]);

  async function save(patch: { strokes?: number | null; on_green_distance_m?: number | null; olympic_points?: number; olympic_special_points?: number; sao_points?: number }) {
    setSaving("saving");
    const r = await safeCall(api.upsertScore({
      round_id: round.id, hole_id: hole.id, player_id: player.id,
      updated_by: "self",
      ...patch
    }));
    setSaving(r ? "saved" : "idle");
    if (r) setTimeout(() => setSaving("idle"), 1200);
  }

  const buttons = entryButtonsFor(hole.par, maxStrokes);
  const currentTerm = termFor(strokes, hole.par);

  return (
    <div className="card p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-white/70 text-sm font-semibold">Score</label>
          {currentTerm && (
            <span className={`chip border ${currentTerm.bg} ${currentTerm.color}`}>
              {currentTerm.icon} {currentTerm.label} · {strokes} strokes
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {buttons.map(b => {
            const term = termFor(b.strokes, hole.par)!;
            const selected = strokes === b.strokes;
            return (
              <button key={b.strokes} onClick={() => { setStrokes(b.strokes); save({ strokes: b.strokes }); }}
                className={`py-3 px-2 rounded-xl border transition text-left
                  ${selected ? "bg-fairway-500 border-fairway-400 text-white scale-[1.02] shadow-lg shadow-fairway-500/30" : `${term.bg} ${term.color} hover:scale-[1.02]`}`}>
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-sm">{b.label}</span>
                  <span className="text-2xl font-extrabold">{b.strokes}</span>
                </div>
                <div className={`text-[10px] mt-0.5 ${selected ? "text-white/80" : "opacity-70"}`}>
                  {b.diff === 0 ? "even par" : b.diff > 0 ? `+${b.diff} over` : `${b.diff} under`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Par-3 nearest-pin removed per spec */}

      {/* Olympic — range 0..N (N = players) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-white/70 text-sm font-semibold">🏆 Olympic</label>
          <span className="text-white/40 text-xs">0..{olyMax} · {round.olympic_stake ?? 10} THB/pt</span>
        </div>
        <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${olyMax + 1}, minmax(0,1fr))` }}>
          {Array.from({ length: olyMax + 1 }, (_, n) => n).map(n => (
            <button key={n} onClick={() => { setOlympic(n); save({ olympic_points: n }); }}
              className={`py-2 rounded-lg text-sm font-bold transition
                ${olympic === n
                  ? "bg-sand-500 text-rough-900 shadow"
                  : n === 0
                    ? "bg-white/5 text-white/60 border border-white/10"
                    : "bg-sand-500/10 text-sand-500 border border-sand-500/30"}`}>
              {n}
            </button>
          ))}
        </div>
        <p className="text-white/40 text-[10px] mt-1.5 leading-relaxed">
          Each opponent pays you this many points (zero-sum). Used by both Olympic and Olympic Extra settlements.
        </p>
      </div>

      {/* Olympic Special — range -3..15 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-white/70 text-sm font-semibold">✨ Olympic Special</label>
          <span className="text-white/40 text-xs">-3..15</span>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
          {Array.from({ length: 19 }, (_, i) => i - 3).map(n => (
            <button key={n} onClick={() => { setOlympicSp(n); save({ olympic_special_points: n }); }}
              className={`py-2 rounded-lg text-sm font-bold transition
                ${olympicSp === n
                  ? "bg-amber-500 text-rough-900 shadow"
                  : n === 0
                    ? "bg-white/5 text-white/60 border border-white/10"
                    : n > 0
                      ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                      : "bg-red-500/10 text-red-300 border border-red-500/30"}`}>
              {n > 0 ? `+${n}` : n}
            </button>
          ))}
        </div>
        <p className="text-white/40 text-[10px] mt-1.5 leading-relaxed">
          Counts toward Olympic settlement but NOT toward Olympic Extra.
        </p>
      </div>

      {/* SAO special-putt tri-state */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-white/70 text-sm font-semibold">⚡ SAO special putt</label>
          <span className="text-white/40 text-xs">±{saoUnit} pts</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: -saoUnit, label: `SAO −${saoUnit}`, cls: "bg-red-500/10 text-red-300 border-red-500/30", on: "bg-red-500 text-white border-red-400" },
            { v: 0,        label: "—",               cls: "bg-white/5 text-white/60 border-white/10",     on: "bg-white/20 text-white border-white/30" },
            { v: saoUnit,  label: `SAO +${saoUnit}`, cls: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30", on: "bg-fuchsia-500 text-white border-fuchsia-400" }
          ].map(o => {
            const selected = sao === o.v;
            return (
              <button key={o.v} onClick={() => { setSao(o.v); save({ sao_points: o.v }); }}
                className={`py-3 rounded-xl font-bold border transition ${selected ? o.on : o.cls}`}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-center text-xs">
        {saving === "saving" ? <span className="text-white/40">Saving…</span> :
         saving === "saved" ? <span className="text-fairway-500 inline-flex items-center gap-1"><Check className="w-3 h-3" />Saved</span> :
         <span className="text-white/30">Changes auto-save</span>}
      </div>
    </div>
  );
}

function AdminHoleEntry({ hole, players, scores, round }: any) {
  const cfg = mergedSettings(round.settings);
  const maxStrokes = 9;
  const buttons = entryButtonsFor(hole.par, maxStrokes);
  const saoUnit = cfg.localRules.saoPoints;
  const olyMax = round.player_count;

  async function update(playerId: string, patch: any) {
    await safeCall(api.upsertScore({
      round_id: round.id, hole_id: hole.id, player_id: playerId,
      updated_by: "admin", ...patch
    }));
  }

  return (
    <div className="card p-3 space-y-2">
      {players.map((p: any) => {
        const s = scores.find((x: any) => x.hole_id === hole.id && x.player_id === p.id);
        const term = termFor(s?.strokes, hole.par);
        const oly = s?.olympic_points ?? 0;
        return (
          <div key={p.id} className="bg-white/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                <span className="text-white font-semibold">{p.name}</span>
              </div>
              {term && (
                <span className={`chip border ${term.bg} ${term.color}`}>
                  {term.icon} {term.label} · {s.strokes}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {buttons.map(b => {
                const bt = termFor(b.strokes, hole.par)!;
                const selected = s?.strokes === b.strokes;
                return (
                  <button key={b.strokes} onClick={() => update(p.id, { strokes: b.strokes })}
                    className={`py-2 rounded-lg border transition text-center
                      ${selected ? "bg-fairway-500 border-fairway-400 text-white" : `${bt.bg} ${bt.color}`}`}>
                    <div className="text-[10px] font-bold leading-none">{b.label}</div>
                    <div className="text-lg font-extrabold">{b.strokes}</div>
                  </button>
                );
              })}
            </div>
            {/* Par-3 nearest-pin removed per spec */}
            <div>
              <div className="text-white/60 text-[11px] mb-1">🏆 Olympic <span className="text-white/30">(0..{olyMax})</span></div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${olyMax + 1}, minmax(0,1fr))` }}>
                {Array.from({ length: olyMax + 1 }, (_, n) => n).map(n => (
                  <button key={n} onClick={() => update(p.id, { olympic_points: n })}
                    className={`py-1.5 rounded-lg text-xs font-bold transition
                      ${oly === n
                        ? "bg-sand-500 text-rough-900"
                        : n === 0
                          ? "bg-white/5 text-white/60 border border-white/10"
                          : "bg-sand-500/10 text-sand-500 border border-sand-500/30"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-white/60 text-[11px] mb-1">✨ Olympic Special <span className="text-white/30">(-3..15)</span></div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                {Array.from({ length: 19 }, (_, i) => i - 3).map(n => (
                  <button key={n} onClick={() => update(p.id, { olympic_special_points: n })}
                    className={`py-1.5 rounded-lg text-xs font-bold transition
                      ${(s?.olympic_special_points ?? 0) === n
                        ? "bg-amber-500 text-rough-900"
                        : n === 0
                          ? "bg-white/5 text-white/60 border border-white/10"
                          : n > 0
                            ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                            : "bg-red-500/10 text-red-300 border border-red-500/30"}`}>
                    {n > 0 ? `+${n}` : n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-white/60 text-[11px] mb-1">⚡ SAO</div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { v: -saoUnit, label: `−${saoUnit}`, on: "bg-red-500 text-white",         off: "bg-red-500/10 text-red-300 border border-red-500/30" },
                  { v: 0,        label: "—",            on: "bg-white/20 text-white",        off: "bg-white/5 text-white/60 border border-white/10" },
                  { v:  saoUnit, label: `+${saoUnit}`, on: "bg-fuchsia-500 text-white",     off: "bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/30" }
                ].map(o => {
                  const selected = (s?.sao_points ?? 0) === o.v;
                  return (
                    <button key={o.v} onClick={() => update(p.id, { sao_points: o.v })}
                      className={`py-1.5 rounded-lg text-xs font-bold transition ${selected ? o.on : o.off}`}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
