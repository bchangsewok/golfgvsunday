"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRound } from "@/lib/useRound";
import { calculate } from "@/lib/scoring";
import { api, safeCall } from "@/lib/api";
import { trackRoundAccess } from "@/lib/device";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Crown, Users, Edit3, Settings, Share2, Trophy, Target, Flag, Swords, Zap, HelpCircle, Users2, LayoutGrid, Rows3 } from "lucide-react";
import { termFor } from "@/lib/golfTerms";
import Link from "next/link";

export default function RoundPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const search = useSearchParams();
  const adminToken = search.get("admin") || "";
  const { round, players, holes, scores, loading, err } = useRound(code);
  const [showQR, setShowQR] = useState(false);
  const [layout, setLayout] = useState<"h" | "v">("h");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("gv:layout") : null;
    if (saved === "v" || saved === "h") setLayout(saved);
  }, []);
  function setLayoutPersist(l: "h" | "v") { setLayout(l); try { localStorage.setItem("gv:layout", l); } catch {} }

  const totals = useMemo(() => {
    if (!round) return null;
    return calculate(players, holes, scores, round.settings, {
      dogFlight: Number(round.dog_flight_stake ?? round.stake_per_point ?? 100),
      olympic:   Number(round.olympic_stake   ?? round.stake_per_point ?? 10)
    });
  }, [round, players, holes, scores]);

  // Track this device's access to the round so it appears in "Your Recent Rounds"
  useEffect(() => {
    if (!round) return;
    const isAdmin = adminToken && adminToken === round.admin_token;
    trackRoundAccess({
      round_id: round.id,
      is_admin: !!isAdmin,
      admin_token: isAdmin ? adminToken : null
    });
  }, [round?.id, adminToken]);

  // Raw input sums per player.
  const rawInputs = useMemo(() => {
    const olyAll: Record<string, number> = {};  // olympic + special, what was actually entered
    const olyEx:  Record<string, number> = {};  // olympic only (the basis for Olympic Extra)
    const sao:    Record<string, number> = {};
    for (const p of players) { olyAll[p.id] = 0; olyEx[p.id] = 0; sao[p.id] = 0; }
    for (const s of scores) {
      const oly = Number(s.olympic_points) || 0;
      const sp  = Number(s.olympic_special_points) || 0;
      olyAll[s.player_id] = (olyAll[s.player_id] || 0) + oly + sp;
      olyEx[s.player_id]  = (olyEx[s.player_id]  || 0) + oly;
      sao[s.player_id]    = (sao[s.player_id]    || 0) + (Number(s.sao_points) || 0);
    }
    return { olyAll, olyEx, sao };
  }, [players, scores]);

  if (loading) return <div className="text-white/60 text-center py-20">Loading round…</div>;
  if (err || !round) return <div className="text-red-400 text-center py-20">{err || "Not found"}</div>;

  const isAdmin = adminToken && adminToken === round.admin_token;
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/round/${code}` : "";
  const leader = totals ? [...players].sort((a, b) => (totals.grandTotal[b.id] || 0) - (totals.grandTotal[a.id] || 0))[0] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {round.name}
            <span className="chip bg-fairway-500/20 text-fairway-500 border border-fairway-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-fairway-500 live-dot" />LIVE
            </span>
          </h1>
          {round.course_name && <p className="text-white/50 text-sm">{round.course_name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQR(s => !s)} className="btn-ghost">
            <Share2 className="w-4 h-4" /> {code}
          </button>
          <Link href={`/round/${code}/score${adminToken ? `?admin=${adminToken}` : ""}`} className="btn-primary">
            <Edit3 className="w-4 h-4" /> Enter scores
          </Link>
          {(round.team_play_enabled ?? 0) === 1 && (
            <Link href={`/round/${code}/team-play${adminToken ? `?admin=${adminToken}` : ""}`} className="btn-ghost">
              <Users2 className="w-4 h-4 text-fairway-500" /> Team Play
            </Link>
          )}
          {isAdmin && (
            <Link href={`/round/${code}/admin?admin=${adminToken}`} className="btn-ghost">
              <Crown className="w-4 h-4" /> Admin
            </Link>
          )}
        </div>
      </div>

      {showQR && (
        <div className="card p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={joinUrl} size={140} />
          </div>
          <div className="space-y-2 flex-1">
            <p className="text-white/70 text-sm">Players scan to join, or share the code:</p>
            <div className="flex items-center gap-2">
              <code className="text-3xl tracking-[0.3em] font-bold text-fairway-500">{code}</code>
              <button onClick={() => navigator.clipboard.writeText(joinUrl)} className="btn-ghost text-xs">
                <Copy className="w-3 h-3" />Copy link
              </button>
            </div>
            <p className="text-white/40 text-xs break-all">{joinUrl}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Users className="w-4 h-4" />} label="Players" value={players.length} />
        <Stat icon={<Trophy className="w-4 h-4" />} label="Leader" value={leader?.name || "—"} />
        <Stat label="Stakes" value={`DF ${round.dog_flight_stake ?? round.stake_per_point} · Oly ${round.olympic_stake ?? round.stake_per_point} ${round.currency}`} />
        <Stat label="Holes" value={`${countCompleteHoles(holes, players, scores)}/${holes.length}`} />
      </div>

      <div className="flex items-center justify-end -mb-3">
        <div className="bg-white/5 border border-white/10 rounded-lg p-0.5 flex gap-0.5">
          <button onClick={() => setLayoutPersist("h")}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition ${layout === "h" ? "bg-fairway-500 text-white" : "text-white/60 hover:text-white"}`}
            title="Horizontal — players in rows, holes in columns">
            <LayoutGrid className="w-3 h-3" /> Horizontal
          </button>
          <button onClick={() => setLayoutPersist("v")}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition ${layout === "v" ? "bg-fairway-500 text-white" : "text-white/60 hover:text-white"}`}
            title="Vertical — holes in rows, players in columns">
            <Rows3 className="w-3 h-3" /> Vertical
          </button>
        </div>
      </div>
      {layout === "h"
        ? <Scoreboard players={players} holes={holes} scores={scores} totals={totals!} currency={round.currency} olyStake={Number(round.olympic_stake ?? round.stake_per_point ?? 10)} code={code} adminToken={adminToken} />
        : <ScoreboardVertical players={players} holes={holes} scores={scores} totals={totals!} currency={round.currency} code={code} adminToken={adminToken} />
      }
      <CategoryBreakdown players={players} totals={totals!} currency={round.currency} rawInputs={rawInputs} />
      <LeaderboardCards players={players} totals={totals!} currency={round.currency} />
      <MultiplierBar holes={holes} isAdmin={!!isAdmin} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 text-white/40 text-xs">{icon}{label}</div>
      <div className="text-white text-lg font-semibold truncate">{value}</div>
    </div>
  );
}

function countCompleteHoles(holes: any[], players: any[], scores: any[]) {
  if (players.length === 0) return 0;
  let n = 0;
  for (const h of holes) {
    const filled = scores.filter(s => s.hole_id === h.id && s.strokes != null).length;
    if (filled === players.length) n++;
  }
  return n;
}

function ScoreChip({ strokes, par }: { strokes: number; par: number }) {
  const diff = strokes - par;
  if (diff <= -1) {
    // Birdie or better — red circle with white text
    return (
      <div className="mx-auto w-7 h-7 rounded-full grid place-items-center text-sm font-bold bg-red-600 text-white shadow-sm">
        {strokes}
      </div>
    );
  }
  if (diff >= 1) {
    // Bogey or worse — dark blue rectangle with white text
    return (
      <div className="mx-auto w-7 h-7 rounded-sm grid place-items-center text-sm font-bold bg-blue-900 text-white shadow-sm">
        {strokes}
      </div>
    );
  }
  // Par — neutral outline
  return (
    <div className="mx-auto w-7 h-7 rounded-md grid place-items-center text-sm font-bold text-white border border-white/40">
      {strokes}
    </div>
  );
}

function Scoreboard({ players, holes, scores, totals, currency, olyStake, code, adminToken }: any) {
  const sortedHoles = [...holes].sort((a: any, b: any) => a.number - b.number);
  // 84 + 18×48 + 100 = 1048 → fits on 1280px container with room to spare.
  // 1fr lets cells stretch on wider screens. Min 48 keeps content readable on smaller ones.
  const COLS = `84px repeat(${sortedHoles.length}, minmax(48px,1fr)) 100px`;
  return (
    <div className="card p-2 overflow-x-auto">
      <div className="min-w-full">
        <div className="grid gap-1 text-xs font-semibold text-white/60 items-center"
             style={{ gridTemplateColumns: COLS }}>
          <div>Player</div>
          {sortedHoles.map(h => (
            <div key={h.id} className="text-center">
              <div>{h.number}</div>
              <div className="text-[10px] text-white/30">P{h.par}{h.multiplier > 1 ? `·×${h.multiplier}` : ""}</div>
            </div>
          ))}
          <div className="text-right">Total</div>
        </div>
        {(() => {
          const foodPool  = players.reduce((s: number, x: any) => s + (Number(x.food_expenses) || 0), 0);
          const foodShare = players.length > 0 ? foodPool / players.length : 0;
          return players.map((p: any) => {
          const totalMoney = totals?.money?.[p.id] || 0;
          const dfMoney    = totals?.dogFlightMoney?.[p.id]  || 0;
          const olyPts     = (totals?.olympicTotal?.[p.id]      || 0)
                            + (totals?.olympicExtraTotal?.[p.id] || 0)
                            + (totals?.saoTotal?.[p.id]          || 0);
          const olyMoney   = olyPts * olyStake;
          const foodPaid   = Number(p.food_expenses) || 0;
          const totalCost  = totalMoney + foodPaid - foodShare; // betting + paid food − fair share
          const totalStrokes = sortedHoles.reduce((sum: number, h: any) => {
            const s = scores.find((x: any) => x.hole_id === h.id && x.player_id === p.id);
            return sum + (s?.strokes || 0);
          }, 0);
          const totalPar = sortedHoles.reduce((sum: number, h: any) => sum + h.par, 0);
          const vsPar = totalStrokes - totalPar;
          return (
            <div key={p.id} className="grid gap-1 items-center py-2 border-t border-white/5"
                 style={{ gridTemplateColumns: COLS }}>
              <div className="flex items-center gap-2 truncate">
                <Link
                  href={`/round/${code}/player/${p.id}${adminToken ? `?admin=${adminToken}` : ""}`}
                  className="w-3 h-3 rounded-full shrink-0 hover:ring-2 hover:ring-white/30"
                  style={{ background: p.color }}
                  title={`${p.name}'s detail page`} />
                <Link
                  href={`/round/${code}/score?player=${p.id}${adminToken ? `&admin=${adminToken}` : ""}`}
                  className="text-white text-sm font-medium truncate hover:text-fairway-500"
                  title={`Update ${p.name}'s scores`}>
                  {p.name}
                </Link>
              </div>
              {sortedHoles.map((h: any) => {
                const s = scores.find((x: any) => x.hole_id === h.id && x.player_id === p.id);
                const ph = totals?.perHole.find((x: any) => x.holeId === h.id);
                const dgMoney  = ph?.dogFlightMoney?.[p.id] || 0;
                const dgPts    = ph?.dogFlightPoints?.[p.id] || 0;
                const olyIn    = s?.olympic_points || 0;
                const olySpIn  = s?.olympic_special_points || 0;
                const saoIn    = s?.sao_points || 0;
                const olyTotal = olyIn + olySpIn;
                const fmt  = (n: number) => `${n > 0 ? "+" : ""}${Number.isInteger(n) ? n : n.toFixed(1)}`;
                const fmtM = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(0)}`;
                return (
                  <div key={h.id} className="text-center">
                    {s?.strokes != null
                      ? <ScoreChip strokes={s.strokes} par={h.par} />
                      : <div className="text-white/30 text-sm">—</div>}
                    {dgPts !== 0 && (
                      <div className={`text-[10px] mt-0.5 tabular-nums leading-tight font-semibold ${dgPts > 0 ? "text-fairway-500" : "text-red-400"}`}
                           title={`Dog Flight ${fmt(dgPts)} pt${h.multiplier > 1 ? ` (×${h.multiplier} mult applied)` : ""} = ${fmtM(dgMoney)} ${currency}`}>
                        DF {fmt(dgPts)}
                      </div>
                    )}
                    {olyTotal !== 0 && (
                      <div className={`text-[10px] tabular-nums leading-tight ${olyTotal > 0 ? "text-sand-500" : "text-red-400"}`}
                           title={olySpIn ? `Olympic ${olyIn} + Special ${olySpIn} = ${olyTotal}` : "Olympic entered"}>
                        🏆 {fmt(olyTotal)}{olySpIn ? <sup className="text-[8px] opacity-70">·{olySpIn}</sup> : null}
                      </div>
                    )}
                    {saoIn !== 0 && (
                      <div className={`text-[10px] tabular-nums leading-tight ${saoIn > 0 ? "text-fuchsia-300" : "text-red-400"}`}
                           title="SAO special putt">
                        ⚡ {fmt(saoIn)}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="text-right">
                <div className="text-[11px] text-white/60 tabular-nums leading-tight">
                  {totalStrokes > 0 ? (
                    <>
                      <span className="text-white font-bold text-sm">{totalStrokes}</span>
                      <span className={`ml-1 ${vsPar > 0 ? "text-red-400" : vsPar < 0 ? "text-sky-300" : "text-white/50"}`}>
                        ({vsPar > 0 ? "+" : ""}{vsPar})
                      </span>
                    </>
                  ) : <span className="text-white/30">—</span>}
                </div>
                <div className={`text-sm font-bold tabular-nums leading-tight ${totalMoney > 0 ? "text-fairway-500" : totalMoney < 0 ? "text-red-400" : "text-white/60"}`}
                     title="Betting only (DF + Olympic + Olympic Extra)">
                  {totalMoney > 0 ? "+" : ""}{totalMoney.toFixed(0)} {currency}
                </div>
                <div className="text-[10px] text-white/50 leading-tight tabular-nums">
                  <span className={dfMoney > 0 ? "text-fairway-500/80" : dfMoney < 0 ? "text-red-400/80" : ""}>
                    DF {dfMoney > 0 ? "+" : ""}{dfMoney.toFixed(0)}
                  </span>
                  {" · "}
                  <span className={olyMoney > 0 ? "text-fairway-500/80" : olyMoney < 0 ? "text-red-400/80" : ""}>
                    Oly {olyMoney > 0 ? "+" : ""}{olyMoney.toFixed(0)}
                  </span>
                </div>
                {(foodPaid > 0 || foodShare > 0) && (
                  <div className="text-[10px] text-white/40 tabular-nums leading-tight">
                    {foodPaid > 0 && <span title="Food you paid (credited)">+Food {foodPaid.toFixed(0)}</span>}
                    {foodShare > 0 && <span title="Your share of the food pool" className="ml-1 text-amber-300/60">−Share {foodShare.toFixed(0)}</span>}
                  </div>
                )}
                {(foodPaid > 0 || foodShare > 0) && (
                  <div className={`text-sm font-bold tabular-nums leading-tight border-t border-white/10 mt-1 pt-1 ${totalCost > 0 ? "text-fairway-500" : totalCost < 0 ? "text-red-400" : "text-white/60"}`}
                       title="Total Cost = betting + food paid − fair share">
                    = {totalCost > 0 ? "+" : ""}{totalCost.toFixed(0)} {currency}
                  </div>
                )}
              </div>
            </div>
          );
        });
        })()}
      </div>
    </div>
  );
}

// Vertical scoreboard: rows = holes, columns = players. Reads top-to-bottom like a classic scorecard.
// Player headers link to score-entry pre-selected for that player; the colored dot links to detail.
function ScoreboardVertical({ players, holes, scores, totals, currency, code, adminToken }: any) {
  const sortedHoles = [...holes].sort((a: any, b: any) => a.number - b.number);
  const foodPool  = players.reduce((s: number, x: any) => s + (Number(x.food_expenses) || 0), 0);
  const foodShare = players.length > 0 ? foodPool / players.length : 0;
  const fmt = (n: number) => `${n > 0 ? "+" : ""}${Number.isInteger(n) ? n : n.toFixed(1)}`;
  const fmtM = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(0)}`;
  const totalPar = sortedHoles.reduce((s: number, h: any) => s + h.par, 0);

  // Pre-compute per-player totals
  const totalsRow = players.map((p: any) => {
    const money = totals?.money?.[p.id] || 0;
    const food  = Number(p.food_expenses) || 0;
    const tc    = money + food - foodShare;
    const strokes = sortedHoles.reduce((sum: number, h: any) => {
      const s = scores.find((x: any) => x.hole_id === h.id && x.player_id === p.id);
      return sum + (s?.strokes || 0);
    }, 0);
    return { p, money, tc, strokes };
  });

  // Column widths tuned to fit a small iPhone (≈ 390 px):
  // meta cols ≈ 92 px + 4×60 = 332 ≈ 332 px → fits with margins.
  return (
    <div className="card p-1 sm:p-2 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
      <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 28 }} />
          <col style={{ width: 28 }} />
          {players.map((p: any) => <col key={p.id} />)}
        </colgroup>
        <thead className="text-white/40 text-[10px]">
          <tr className="border-b border-white/10">
            <th className="py-1 px-1 text-left">#</th>
            <th className="py-1 px-0.5 text-center">P</th>
            <th className="py-1 px-0.5 text-center">×</th>
            {players.map((p: any) => (
              <th key={p.id} className="py-1 px-0.5 text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <Link
                    href={`/round/${code}/player/${p.id}${adminToken ? `?admin=${adminToken}` : ""}`}
                    className="w-2.5 h-2.5 rounded-full hover:ring-2 hover:ring-white/30"
                    style={{ background: p.color }}
                    title={`${p.name}'s detail`} />
                  <Link
                    href={`/round/${code}/score?player=${p.id}${adminToken ? `&admin=${adminToken}` : ""}`}
                    className="text-white text-[10px] font-semibold hover:text-fairway-500 truncate max-w-[60px] block"
                    title={`Update ${p.name}'s scores`}>
                    {p.name}
                  </Link>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedHoles.map((h: any) => (
            <tr key={h.id} className="border-b border-white/5">
              <td className="py-1 px-1 text-white/80 font-mono text-xs">{h.number}</td>
              <td className="py-1 px-0.5 text-center text-white/50 text-xs">{h.par}</td>
              <td className="py-1 px-0.5 text-center text-white/40 text-xs">{h.multiplier > 1 ? h.multiplier : "·"}</td>
              {players.map((p: any) => {
                const s = scores.find((x: any) => x.hole_id === h.id && x.player_id === p.id);
                const ph = totals?.perHole.find((x: any) => x.holeId === h.id);
                const dgPts   = ph?.dogFlightPoints?.[p.id] || 0;
                const dgMoney = ph?.dogFlightMoney?.[p.id]  || 0;
                const olyIn   = s?.olympic_points || 0;
                const olySpIn = s?.olympic_special_points || 0;
                const saoIn   = s?.sao_points || 0;
                const olyHole = olyIn + olySpIn;
                return (
                  <td key={p.id} className="py-1 px-0.5 text-center align-top">
                    <Link
                      href={`/round/${code}/score?player=${p.id}${adminToken ? `&admin=${adminToken}` : ""}`}
                      className="block hover:opacity-80 transition"
                      title={`Update ${p.name} · hole ${h.number}`}>
                      {s?.strokes != null
                        ? <ScoreChip strokes={s.strokes} par={h.par} />
                        : <div className="text-white/30 text-sm py-1">—</div>}
                      {dgPts !== 0 && (
                        <div className={`text-[9px] tabular-nums leading-none mt-0.5 ${dgPts > 0 ? "text-fairway-500" : "text-red-400"}`}
                             title={`DF ${fmt(dgPts)} pt = ${fmtM(dgMoney)} ${currency}`}>
                          {fmt(dgPts)}
                        </div>
                      )}
                      {olyHole !== 0 && (
                        <div className={`text-[9px] tabular-nums leading-none ${olyHole > 0 ? "text-sand-500" : "text-red-400"}`}>
                          🏆{fmt(olyHole)}
                        </div>
                      )}
                      {saoIn !== 0 && (
                        <div className={`text-[9px] tabular-nums leading-none ${saoIn > 0 ? "text-fuchsia-300" : "text-red-400"}`}>
                          ⚡{fmt(saoIn)}
                        </div>
                      )}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
          {/* Totals row */}
          <tr className="border-t-2 border-white/15 font-bold bg-white/5">
            <td className="py-1.5 px-1 text-white text-xs">Tot</td>
            <td className="py-1.5 px-0.5 text-center text-white/60 text-xs">{totalPar}</td>
            <td></td>
            {totalsRow.map(({ p, strokes }: any) => (
              <td key={p.id + "-strokes"} className="py-1.5 px-0.5 text-center">
                {strokes > 0 ? (
                  <div className="text-white tabular-nums text-xs">
                    {strokes}
                    <span className={`block text-[9px] leading-none ${strokes - totalPar > 0 ? "text-red-400" : strokes - totalPar < 0 ? "text-sky-300" : "text-white/50"}`}>
                      ({strokes - totalPar > 0 ? "+" : ""}{strokes - totalPar})
                    </span>
                  </div>
                ) : <span className="text-white/30 text-xs">—</span>}
              </td>
            ))}
          </tr>
          {/* Money row */}
          <tr className="border-b border-white/5">
            <td className="py-1 px-1 text-white/80 text-[10px]">$</td>
            <td colSpan={2}></td>
            {totalsRow.map(({ p, tc }: any) => (
              <td key={p.id + "-money"} className={`py-1 px-0.5 text-center text-[10px] font-bold tabular-nums leading-tight ${tc > 0 ? "text-fairway-500" : tc < 0 ? "text-red-400" : "text-white/60"}`}
                  title={`Bet + food paid − fair share`}>
                {tc > 0 ? "+" : ""}{tc.toFixed(0)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardCards({ players, totals, currency }: any) {
  const foodPool  = players.reduce((s: number, x: any) => s + (Number(x.food_expenses) || 0), 0);
  const foodShare = players.length > 0 ? foodPool / players.length : 0;
  const totalCostOf = (p: any) => (totals?.money?.[p.id] || 0) + (Number(p.food_expenses) || 0) - foodShare;
  const ranked = [...players].sort((a, b) => totalCostOf(b) - totalCostOf(a));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {ranked.map((p, idx) => {
        const m = totals?.money?.[p.id] || 0;
        const food = Number(p.food_expenses) || 0;
        const tc = m + food - foodShare;
        return (
          <div key={p.id} className="card p-4 flex items-center gap-3 relative overflow-hidden">
            <div className="absolute top-2 right-3 text-2xl">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : ""}</div>
            <div className="w-12 h-12 rounded-full grid place-items-center text-white font-bold text-lg shadow-lg"
                 style={{ background: p.color }}>
              {p.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold truncate">{p.name}</div>
              <div className="text-white/40 text-[11px] flex flex-wrap gap-x-2">
                <span><Swords className="inline w-3 h-3" /> DF {(totals?.dogFlightMoney?.[p.id] || 0).toFixed(0)}</span>
                <span><Trophy className="inline w-3 h-3" /> Oly {(totals?.olympicTotal?.[p.id] || 0).toFixed(1)}</span>
                <span><Trophy className="inline w-3 h-3" /> Ext {(totals?.olympicExtraTotal?.[p.id] || 0).toFixed(1)}</span>
                <span><Zap    className="inline w-3 h-3" /> SAO {(totals?.saoTotal?.[p.id]      || 0).toFixed(1)}</span>
                {food > 0 && <span className="text-amber-300/80">🍽️ +{food.toFixed(0)}</span>}
              </div>
              <div className={`text-lg font-bold ${tc > 0 ? "text-fairway-500" : tc < 0 ? "text-red-400" : "text-white/60"}`}>
                {tc > 0 ? "+" : ""}{tc.toFixed(0)} {currency}
                {(food > 0 || foodShare > 0) && (
                  <span className="text-[10px] text-white/40 font-normal ml-1 tabular-nums">
                    (bet {m > 0 ? "+" : ""}{m.toFixed(0)} + food {food.toFixed(0)} − share {foodShare.toFixed(0)})
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBreakdown({ players, totals, currency, rawInputs }: any) {
  // Each tile derives its money/points via a function so we can combine multiple sources.
  const cats = [
    {
      key: "df", label: "Dog Flight",
      icon: <Swords className="w-4 h-4" />, color: "text-orange-300",
      money: (id: string) => totals?.dogFlightMoney?.[id]        || 0,
      pts:   (id: string) => totals?.dogFlightPointsTotal?.[id]  || 0,
      raw:   null
    },
    {
      // Olympic combines: Olympic + Olympic Special + SAO
      key: "oly", label: "Olympic",
      icon: <Trophy className="w-4 h-4" />, color: "text-sand-500",
      money: (id: string) => (totals?.olympicMoney?.[id] || 0) + (totals?.saoMoney?.[id] || 0),
      pts:   (id: string) => (totals?.olympicTotal?.[id] || 0) + (totals?.saoTotal?.[id] || 0),
      raw:   (id: string) => (rawInputs?.olyAll?.[id]   || 0) + (rawInputs?.sao?.[id]    || 0)
    },
    {
      key: "olyEx", label: "Olympic Extra",
      icon: <Trophy className="w-4 h-4" />, color: "text-amber-300",
      help: "/help/olympic-extra",
      money: (id: string) => totals?.olympicExtraMoney?.[id] || 0,
      pts:   (id: string) => totals?.olympicExtraTotal?.[id] || 0,
      raw:   (id: string) => totals?.olympicExtraRaw?.[id]   || 0
    }
  ];
  const fmt = (n: number) => `${n > 0 ? "+" : ""}${Number.isInteger(n) ? n : n.toFixed(1)}`;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cats.map(c => {
        const ranked = [...players].sort((a, b) => c.money(b.id) - c.money(a.id));
        return (
          <div key={c.key} className="card p-3">
            <div className={`flex items-center gap-1.5 mb-2 font-semibold ${c.color}`}>
              {c.icon}
              <span>{c.label}</span>
              {(c as any).help && (
                <Link href={(c as any).help} className="ml-auto text-white/40 hover:text-white/80 transition" title="How does this work?">
                  <HelpCircle className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            <div className="space-y-1.5">
              {ranked.map(p => {
                const netPts = c.pts(p.id);
                const money  = c.money(p.id);
                const raw    = c.raw ? c.raw(p.id) : null;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-white/80 truncate min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="text-right">
                      <span className={`font-bold tabular-nums ${money > 0 ? "text-fairway-500" : money < 0 ? "text-red-400" : "text-white/40"}`}>
                        {money > 0 ? "+" : ""}{money.toFixed(0)} {currency}
                      </span>
                      <span className="block text-[10px] tabular-nums text-white/40 leading-tight">
                        net {fmt(netPts)} pt
                        {raw !== null && <span className="ml-1">· raw {fmt(raw)}</span>}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MultiplierBar({ holes, isAdmin }: { holes: any[]; isAdmin: boolean }) {
  const sorted = [...holes].sort((a, b) => a.number - b.number);
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white/80 text-sm font-semibold flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" />Hole settings</h3>
        {!isAdmin && <span className="text-white/40 text-xs">view-only — admin link required to edit</span>}
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-min">
          {sorted.map(h => <HoleSettingsCell key={h.id} hole={h} isAdmin={isAdmin} />)}
        </div>
      </div>
    </div>
  );
}

function HoleSettingsCell({ hole, isAdmin }: { hole: any; isAdmin: boolean }) {
  // Local state + onBlur commit avoids firing API calls on every keystroke
  // and prevents constraint-violation errors when the field is briefly empty/invalid.
  const [par, setParLocal] = useState(hole.par);
  const [mult, setMultLocal] = useState(hole.multiplier);
  useEffect(() => { setParLocal(hole.par); }, [hole.par]);
  useEffect(() => { setMultLocal(hole.multiplier); }, [hole.multiplier]);

  async function commitPar(v: number) {
    const clamped = Math.max(3, Math.min(6, v || hole.par));
    setParLocal(clamped);
    if (clamped !== hole.par) await safeCall(api.patchHole(hole.id, { par: clamped }));
  }
  async function commitMult(v: number) {
    const clamped = Math.max(1, Math.min(9, v || hole.multiplier));
    setMultLocal(clamped);
    if (clamped !== hole.multiplier) await safeCall(api.patchHole(hole.id, { multiplier: clamped }));
  }

  return (
    <div className="bg-white/5 rounded-lg p-2 min-w-[72px] text-center">
      <div className="text-white/60 text-xs">Hole {hole.number}</div>
      <input type="number" min={3} max={6} disabled={!isAdmin}
        value={par}
        onChange={e => setParLocal(Number(e.target.value))}
        onBlur={e => commitPar(Number(e.target.value))}
        className="w-full mt-1 bg-transparent text-center text-white text-sm border-b border-white/10 disabled:opacity-60" />
      <div className="text-white/40 text-[10px] mt-1">×</div>
      <input type="number" min={1} max={9} disabled={!isAdmin}
        value={mult}
        onChange={e => setMultLocal(Number(e.target.value))}
        onBlur={e => commitMult(Number(e.target.value))}
        className="w-full bg-transparent text-center text-fairway-500 text-sm font-bold border-b border-white/10 disabled:opacity-60" />
    </div>
  );
}
