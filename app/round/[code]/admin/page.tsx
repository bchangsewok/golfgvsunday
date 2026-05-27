"use client";

import { useSearchParams } from "next/navigation";
import { useRound } from "@/lib/useRound";
import { api } from "@/lib/api";
import { PLAYER_COLORS, DEFAULT_LOCAL_RULES, DEFAULT_TEAM_PLAY, mergedSettings } from "@/lib/defaults";
import Link from "next/link";
import { ChevronLeft, Save, Trophy, Flag, Target, Swords, Zap, Users } from "lucide-react";
import { useEffect, useState } from "react";

export default function AdminPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const search = useSearchParams();
  const adminToken = search.get("admin") || "";
  const { round, players, loading, err } = useRound(code);
  const [draft, setDraft] = useState<any>(null);
  const [rules, setRules] = useState(DEFAULT_LOCAL_RULES);
  const [teamRules, setTeamRules] = useState(DEFAULT_TEAM_PLAY);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!round) return;
    setDraft({
      name: round.name, course_name: round.course_name || "",
      dog_flight_stake: round.dog_flight_stake ?? round.stake_per_point ?? 100,
      olympic_stake:    round.olympic_stake   ?? round.stake_per_point ?? 10,
      currency: round.currency,
      player_count: round.player_count,
      team_play_enabled: (round.team_play_enabled ?? 0) === 1,
      team_play_stake:   round.team_play_stake   ?? 100
    });
    const m = mergedSettings(round.settings);
    setRules(m.localRules);
    setTeamRules(m.teamPlay);
  }, [round?.id]);

  if (loading) return <div className="text-white/60 text-center py-20">Loading…</div>;
  if (err || !round) return <div className="text-red-400 text-center py-20">Not found</div>;
  if (adminToken !== round.admin_token) {
    return <div className="text-red-400 text-center py-20">Admin token required.</div>;
  }
  if (!draft) return null;

  async function saveRound() {
    await api.patchRound(round!.code, {
      admin_token: adminToken,
      name: draft.name, course_name: draft.course_name || null,
      dog_flight_stake: draft.dog_flight_stake,
      olympic_stake: draft.olympic_stake,
      currency: draft.currency,
      player_count: draft.player_count,
      team_play_enabled: draft.team_play_enabled ? 1 : 0,
      team_play_stake: draft.team_play_stake
    });
    flash();
  }
  async function saveRules() {
    await api.patchRound(round!.code, {
      admin_token: adminToken,
      settings: { ...(round!.settings || {}), localRules: rules }
    });
    flash();
  }
  async function saveTeamRules() {
    await api.patchRound(round!.code, {
      admin_token: adminToken,
      settings: { ...(round!.settings || {}), teamPlay: teamRules }
    });
    flash();
  }
  async function setTeam(playerId: string, team: "A" | "B" | null) {
    await api.patchPlayer(playerId, { team });
  }
  function flash() { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200); }

  const teamPlayOn = !!draft.team_play_enabled;
  const teamACount = players.filter(p => p.team === "A").length;
  const teamBCount = players.filter(p => p.team === "B").length;

  async function renamePlayer(id: string, name: string) { await api.patchPlayer(id, { name }); }
  async function setColor(id: string, color: string)     { await api.patchPlayer(id, { color }); }
  async function setHandicap(id: string, h: number)      { await api.patchPlayer(id, { handicap: h }); }
  async function setPlaysDF(id: string, yes: boolean)    { await api.patchPlayer(id, { plays_dog_flight: yes ? 1 : 0 }); }
  async function setAppliesMult(id: string, yes: boolean){ await api.patchPlayer(id, { applies_multiplier: yes ? 1 : 0 }); }
  async function setFood(id: string, amount: number)     { await api.patchPlayer(id, { food_expenses: amount }); }

  const ruleField = (k: keyof typeof rules, label: string, icon: React.ReactNode, suffix?: string) => (
    <label className="bg-white/5 rounded-xl p-3 block">
      <div className="flex items-center justify-between text-white/70 text-xs mb-1">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        {suffix && <span className="text-white/40">{suffix}</span>}
      </div>
      <input className="input text-lg font-semibold py-2" type="number" min={0}
        value={rules[k] as any}
        onChange={e => setRules({ ...rules, [k]: Number(e.target.value) } as any)} />
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href={`/round/${code}?admin=${adminToken}`} className="btn-ghost">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        {savedFlash && <span className="chip bg-fairway-500/20 text-fairway-500 border border-fairway-500/30">✓ Saved</span>}
      </div>
      <h1 className="text-2xl font-bold text-white">Admin · {round.name}</h1>

      <div className="card p-4 space-y-3">
        <h2 className="text-white/80 font-semibold">Round</h2>
        <input className="input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <input className="input" value={draft.course_name} placeholder="Course" onChange={e => setDraft({ ...draft, course_name: e.target.value })} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="text-white/70 text-sm">🗡️ Dog Flight /pt
            <input className="input mt-1" type="number" min={0} value={draft.dog_flight_stake}
              onChange={e => setDraft({ ...draft, dog_flight_stake: Number(e.target.value) || 0 })} />
          </label>
          <label className="text-white/70 text-sm">🏆 Olympic /pt
            <input className="input mt-1" type="number" min={0} value={draft.olympic_stake}
              onChange={e => setDraft({ ...draft, olympic_stake: Number(e.target.value) || 0 })} />
          </label>
          <label className="text-white/70 text-sm">Currency
            <input className="input mt-1" value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })} />
          </label>
          <label className="text-white/70 text-sm">Players
            <input className="input mt-1" type="number" min={1} max={6} value={draft.player_count} onChange={e => setDraft({ ...draft, player_count: Number(e.target.value) })} />
          </label>
        </div>
        <label className="flex items-center gap-2 mt-2 bg-white/5 rounded-xl p-3 cursor-pointer">
          <input type="checkbox" checked={teamPlayOn}
            onChange={e => setDraft({ ...draft, team_play_enabled: e.target.checked })}
            className="w-5 h-5 accent-fairway-500" />
          <Users className="w-4 h-4 text-fairway-500" />
          <span className="text-white/80 text-sm font-semibold">Enable Team Play</span>
          <span className="text-white/40 text-xs ml-auto">a parallel mode — doesn't affect DF / Olympic / Olympic Extra</span>
        </label>
        {teamPlayOn && (
          <label className="text-white/70 text-sm block">
            👥 Team Play stake (THB per team point)
            <input className="input mt-1" type="number" min={0} value={draft.team_play_stake}
              onChange={e => setDraft({ ...draft, team_play_stake: Number(e.target.value) || 0 })} />
          </label>
        )}
        <button onClick={saveRound} className="btn-primary"><Save className="w-4 h-4" />Save round</button>
      </div>

      {/* Team Play settings — only shown when enabled */}
      {teamPlayOn && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white/80 font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-fairway-500" />Team Play · point values
            </h2>
            <Link href={`/round/${code}/team-play${adminToken ? `?admin=${adminToken}` : ""}`} className="btn-ghost text-xs">
              Open Team Play dashboard →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="bg-white/5 rounded-xl p-3 block">
              <div className="text-white/60 text-xs mb-1">Par win pts</div>
              <input className="input text-lg font-semibold py-2" type="number" min={0}
                value={teamRules.parPoints}
                onChange={e => setTeamRules({ ...teamRules, parPoints: Number(e.target.value) || 0 })} />
            </label>
            <label className="bg-white/5 rounded-xl p-3 block">
              <div className="text-white/60 text-xs mb-1">Birdie win pts</div>
              <input className="input text-lg font-semibold py-2" type="number" min={0}
                value={teamRules.birdiePoints}
                onChange={e => setTeamRules({ ...teamRules, birdiePoints: Number(e.target.value) || 0 })} />
            </label>
            <label className="bg-white/5 rounded-xl p-3 block">
              <div className="text-white/60 text-xs mb-1">Eagle+ win pts</div>
              <input className="input text-lg font-semibold py-2" type="number" min={0}
                value={teamRules.eaglePoints}
                onChange={e => setTeamRules({ ...teamRules, eaglePoints: Number(e.target.value) || 0 })} />
            </label>
            <label className="bg-white/5 rounded-xl p-3 block">
              <div className="text-white/60 text-xs mb-1">Stake per pt (THB)</div>
              <input className="input text-lg font-semibold py-2" type="number" min={0}
                value={draft.team_play_stake}
                onChange={e => setDraft({ ...draft, team_play_stake: Number(e.target.value) || 0 })} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="bg-white/5 rounded-xl p-3 block">
              <div className="text-white/60 text-xs mb-1">Team A name</div>
              <input className="input py-2" value={teamRules.teamAName}
                onChange={e => setTeamRules({ ...teamRules, teamAName: e.target.value })} />
              <input type="color" value={teamRules.teamAColor}
                onChange={e => setTeamRules({ ...teamRules, teamAColor: e.target.value })}
                className="mt-2 w-full h-8 rounded cursor-pointer" />
            </label>
            <label className="bg-white/5 rounded-xl p-3 block">
              <div className="text-white/60 text-xs mb-1">Team B name</div>
              <input className="input py-2" value={teamRules.teamBName}
                onChange={e => setTeamRules({ ...teamRules, teamBName: e.target.value })} />
              <input type="color" value={teamRules.teamBColor}
                onChange={e => setTeamRules({ ...teamRules, teamBColor: e.target.value })}
                className="mt-2 w-full h-8 rounded cursor-pointer" />
            </label>
          </div>
          <p className="text-white/40 text-xs leading-relaxed">
            Per hole: take the lowest stroke from each team. Winning team's best score determines payout:
            par or worse = <b>{teamRules.parPoints}</b> pt, birdie = <b>{teamRules.birdiePoints}</b> pts,
            eagle or better = <b>{teamRules.eaglePoints}</b> pts. Money = team points × {draft.team_play_stake} THB, split equally per team member.
            Currently <b>{teamACount}</b> on {teamRules.teamAName} · <b>{teamBCount}</b> on {teamRules.teamBName}.
          </p>
          <button onClick={saveTeamRules} className="btn-primary"><Save className="w-4 h-4" />Save Team Play rules</button>
        </div>
      )}

      {/* Local Rules */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white/80 font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-sand-500" />Local Rules · Olympic points
          </h2>
          <span className="text-white/40 text-xs">{draft.olympic_stake} {draft.currency}/pt</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ruleField("birdiePoints",     "Birdie Olympic",      <Flag className="w-3 h-3 text-cyan-400" />,      "pts")}
          {ruleField("eaglePoints",      "Eagle Olympic",       <Flag className="w-3 h-3 text-sky-400" />,       "pts")}
          {ruleField("par3NearPinPoints","Par-3 near pin",      <Target className="w-3 h-3 text-fairway-500" />, "pts")}
          {ruleField("dfBirdieMult",     "DF birdie × mult",    <Swords className="w-3 h-3 text-orange-300" />,  "×")}
          {ruleField("dfEagleMult",      "DF eagle × mult",     <Swords className="w-3 h-3 text-orange-400" />,  "×")}
          {ruleField("saoPoints",        "SAO points (± value)",<Zap className="w-3 h-3 text-fuchsia-300" />,    "pts")}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <label className="bg-white/5 rounded-xl p-3 flex items-center justify-between text-white/80 text-sm cursor-pointer">
            <span>Olympic</span>
            <input type="checkbox" checked={rules.enableOlympic}
              onChange={e => setRules({ ...rules, enableOlympic: e.target.checked })}
              className="w-5 h-5 accent-fairway-500" />
          </label>
          <label className="bg-white/5 rounded-xl p-3 flex items-center justify-between text-white/80 text-sm cursor-pointer">
            <span>Dog Flight</span>
            <input type="checkbox" checked={rules.enableDogFlight}
              onChange={e => setRules({ ...rules, enableDogFlight: e.target.checked })}
              className="w-5 h-5 accent-fairway-500" />
          </label>
          <label className="bg-white/5 rounded-xl p-3 flex items-center justify-between text-white/80 text-sm cursor-pointer">
            <span>SAO</span>
            <input type="checkbox" checked={rules.enableSao}
              onChange={e => setRules({ ...rules, enableSao: e.target.checked })}
              className="w-5 h-5 accent-fairway-500" />
          </label>
        </div>
        <p className="text-white/40 text-xs leading-relaxed">
          <b className="text-white/70">Dog Flight</b> is pairwise: every pair compared, base = stake × hole-multiplier;
          winner with birdie multiplies by <b>{rules.dfBirdieMult}</b>×, eagle by <b>{rules.dfEagleMult}</b>×.
          {' '}<b className="text-white/70">Olympic</b> achievement: birdie gives <b>{rules.birdiePoints}</b> pts from each opponent, eagle <b>{rules.eaglePoints}</b> pts.
          {' '}<b className="text-white/70">SAO</b> is a tri-state special putt worth ±<b>{rules.saoPoints}</b> pts (paid by each opponent).
          {' '}All ×hole multiplier.
        </p>
        <button onClick={saveRules} className="btn-primary"><Save className="w-4 h-4" />Save local rules</button>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="text-white/80 font-semibold">Players</h2>
        <div className={`text-white/40 text-[11px] grid ${teamPlayOn ? "grid-cols-14" : "grid-cols-12"} gap-2 px-1`}
             style={teamPlayOn ? { gridTemplateColumns: "repeat(14, minmax(0, 1fr))" } : undefined}>
          <span className="col-span-1">Color</span>
          <span className="col-span-3">Name</span>
          <span className="col-span-1 text-center">HCP</span>
          <span className="col-span-2 text-center">Plays DF</span>
          <span className="col-span-2 text-center">Apply ×Mult</span>
          {teamPlayOn && <span className="col-span-2 text-center">Team</span>}
          <span className="col-span-3 text-right">Food &amp; Expenses (THB)</span>
        </div>
        {players.map(p => (
          <div key={p.id} className="grid gap-2 items-center"
               style={{ gridTemplateColumns: teamPlayOn ? "repeat(14, minmax(0, 1fr))" : "repeat(12, minmax(0, 1fr))" }}>
            <div className="col-span-1">
              <select value={p.color} onChange={e => setColor(p.id, e.target.value)}
                className="input text-xs p-1"
                style={{ background: p.color, color: "#fff" }}>
                {PLAYER_COLORS.map(c => <option key={c} value={c} style={{ background: c }}>{c}</option>)}
              </select>
            </div>
            <input className="input col-span-3" defaultValue={p.name}
              onBlur={e => renamePlayer(p.id, e.target.value)} />
            <input className="input col-span-1 text-center" type="number" step="0.5" defaultValue={p.handicap}
              onBlur={e => setHandicap(p.id, Number(e.target.value))} />
            <label className="col-span-2 flex items-center justify-center gap-1.5 cursor-pointer bg-white/5 rounded-xl py-2.5">
              <input type="checkbox"
                checked={(p.plays_dog_flight ?? 1) === 1}
                onChange={e => setPlaysDF(p.id, e.target.checked)}
                className="w-4 h-4 accent-fairway-500" />
              <span className="text-white/70 text-xs">{(p.plays_dog_flight ?? 1) === 1 ? "Yes" : "No"}</span>
            </label>
            <label className="col-span-2 flex items-center justify-center gap-1.5 cursor-pointer bg-white/5 rounded-xl py-2.5">
              <input type="checkbox"
                checked={(p.applies_multiplier ?? 1) === 1}
                onChange={e => setAppliesMult(p.id, e.target.checked)}
                className="w-4 h-4 accent-fairway-500" />
              <span className="text-white/70 text-xs">{(p.applies_multiplier ?? 1) === 1 ? "Yes" : "No"}</span>
            </label>
            {teamPlayOn && (
              <select className="input col-span-2 text-center text-xs"
                value={p.team ?? ""}
                onChange={e => setTeam(p.id, (e.target.value === "" ? null : (e.target.value as "A" | "B")))}
                style={{
                  background: p.team === "A" ? teamRules.teamAColor : p.team === "B" ? teamRules.teamBColor : undefined,
                  color: p.team ? "#fff" : undefined,
                  fontWeight: p.team ? "bold" : undefined
                }}>
                <option value="">— none —</option>
                <option value="A">{teamRules.teamAName}</option>
                <option value="B">{teamRules.teamBName}</option>
              </select>
            )}
            <input className="input col-span-3 text-right" type="number" min={0} step="10"
              defaultValue={p.food_expenses ?? 0}
              onBlur={e => setFood(p.id, Number(e.target.value) || 0)} />
          </div>
        ))}
        <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-white/60 text-xs">
          <span>Total food &amp; expenses across players:</span>
          <span className="text-white font-semibold tabular-nums">
            {players.reduce((s, p) => s + (Number(p.food_expenses) || 0), 0).toFixed(0)} {round.currency}
          </span>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-white/80 font-semibold mb-2">Share</h2>
        <p className="text-white/60 text-sm">Round code: <code className="text-fairway-500 font-bold">{code}</code></p>
        <p className="text-white/40 text-xs mt-2 break-all">Admin URL (keep secret): {typeof window !== "undefined" && `${window.location.origin}/round/${code}?admin=${adminToken}`}</p>
      </div>
    </div>
  );
}
