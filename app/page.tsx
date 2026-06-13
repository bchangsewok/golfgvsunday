"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Course } from "@/lib/types";
import { genCode, genToken, PLAYER_COLORS } from "@/lib/defaults";
import { Loader2, Plus, LogIn, MapPin, Smartphone, Crown, Edit3, X, Trash2, ListOrdered } from "lucide-react";
import Link from "next/link";
import { fetchDeviceRounds, getDeviceLabel, setDeviceLabel, trackRoundAccess, forgetRound, type DeviceRound } from "@/lib/device";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");

  return (
    <div className="space-y-6">
      <RecentRoundsCard />
    <div className="grid md:grid-cols-2 gap-6 items-start">
      <section className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
          Sunday golf,<br />
          <span className="text-fairway-500">settled in real time.</span>
        </h1>
        <p className="text-white/70 leading-relaxed">
          Dog Flight betting, Japanese Olympic, and nearest-on-green — all scored live
          on every phone in the group. Create a round, share the code, play.
        </p>
        <ul className="text-white/60 text-sm space-y-2 pt-2">
          <li>· 1–6 players · per-hole multipliers · QR/code join</li>
          <li>· Players record their own; admin can record all</li>
          <li>· Live dashboard updates across all devices</li>
        </ul>
      </section>

      <div className="card p-2">
        <div className="grid grid-cols-2 gap-1 p-1 bg-black/20 rounded-xl mb-3">
          <button
            onClick={() => setTab("create")}
            className={`py-2 rounded-lg text-sm font-semibold transition ${tab === "create" ? "bg-fairway-500 text-white" : "text-white/60"}`}>
            <Plus className="inline w-4 h-4 mr-1" />New round
          </button>
          <button
            onClick={() => setTab("join")}
            className={`py-2 rounded-lg text-sm font-semibold transition ${tab === "join" ? "bg-fairway-500 text-white" : "text-white/60"}`}>
            <LogIn className="inline w-4 h-4 mr-1" />Join with code
          </button>
        </div>
        {tab === "create"
          ? <CreateRound onCreated={(code, token) => router.push(`/round/${code}?admin=${token}`)} />
          : <JoinRound  onJoined={code => router.push(`/round/${code}`)} />}
      </div>
    </div>
    </div>
  );
}

function RecentRoundsCard() {
  const [rounds, setRounds] = useState<DeviceRound[] | null>(null);
  const [label, setLabelState] = useState("");
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  async function reload() {
    setRounds(await fetchDeviceRounds());
  }
  useEffect(() => {
    setLabelState(getDeviceLabel());
    reload();
  }, []);

  function saveLabel() {
    const trimmed = labelDraft.trim();
    setDeviceLabel(trimmed);
    setLabelState(trimmed);
    setEditingLabel(false);
  }

  async function handleForget(round_id: string) {
    if (!confirm("Forget this round from your device?")) return;
    await forgetRound(round_id);
    reload();
  }

  if (!rounds || rounds.length === 0) {
    return (
      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Smartphone className="w-5 h-5 text-white/40 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-white/70 text-sm">
              {label ? <>This is <b className="text-white">{label}</b></> : "No recent rounds yet on this device."}
            </div>
            <div className="text-white/40 text-xs">Create or join a round below — it'll appear here next time.</div>
          </div>
        </div>
        <Link href="/rounds" className="btn-ghost text-xs py-1 px-2">
          <ListOrdered className="w-3 h-3" /> My rounds
        </Link>
        {editingLabel ? (
          <div className="flex gap-1">
            <input className="input py-1 text-xs w-40"
              placeholder="e.g. Bongkarn's iPhone"
              value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
              autoFocus />
            <button onClick={saveLabel} className="btn-primary py-1 px-2 text-xs">Save</button>
            <button onClick={() => setEditingLabel(false)} className="btn-ghost py-1 px-2 text-xs"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => { setLabelDraft(label); setEditingLabel(true); }} className="btn-ghost text-xs py-1 px-2">
            <Edit3 className="w-3 h-3" /> {label ? "Rename" : "Name this device"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-fairway-500" /> Your recent rounds
          {label && <span className="text-white/40 text-xs">· {label}</span>}
        </h2>
        <Link href="/rounds" className="btn-ghost text-xs py-1 px-2">
          <ListOrdered className="w-3 h-3" /> My rounds
        </Link>
        {editingLabel ? (
          <div className="flex gap-1">
            <input className="input py-1 text-xs w-40"
              placeholder="e.g. Bongkarn's iPhone"
              value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
              autoFocus />
            <button onClick={saveLabel} className="btn-primary py-1 px-2 text-xs">Save</button>
            <button onClick={() => setEditingLabel(false)} className="btn-ghost py-1 px-2 text-xs"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => { setLabelDraft(label); setEditingLabel(true); }} className="btn-ghost text-xs py-1 px-2">
            <Edit3 className="w-3 h-3" /> {label ? "Rename" : "Name device"}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {rounds.map(r => {
          const isAdmin = r.is_admin === 1 && r.admin_token;
          const href = `/round/${r.code}${isAdmin ? `?admin=${r.admin_token}` : ""}`;
          return (
            <div key={r.id} className="bg-white/5 rounded-xl p-3 border border-white/10 hover:bg-white/10 transition group relative">
              <Link href={href} className="block">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <code className="text-fairway-500 font-bold text-sm tracking-wider">{r.code}</code>
                  {isAdmin && <span className="chip bg-sand-500/20 text-sand-500 border border-sand-500/30 text-[10px]"><Crown className="w-3 h-3" />Admin</span>}
                  {!isAdmin && r.player_id && r.player_color && (
                    <span className="chip bg-fairway-500/20 text-fairway-500 border border-fairway-500/30 text-[10px]" style={{ background: `${r.player_color}30`, color: r.player_color, borderColor: `${r.player_color}60` }}>
                      {r.player_name}
                    </span>
                  )}
                  {!isAdmin && !r.player_id && <span className="chip bg-white/5 text-white/50 border border-white/10 text-[10px]">viewer</span>}
                </div>
                <div className="text-white text-sm font-semibold truncate">{r.name}</div>
                <div className="text-white/40 text-xs flex items-center gap-1 truncate">
                  {r.course_name && <><MapPin className="w-3 h-3 flex-shrink-0" />{r.course_name}</>}
                </div>
                <div className="text-white/30 text-[10px] mt-1">
                  {r.status === "active"
                    ? <span className="text-fairway-500">● live</span>
                    : "✓ finished"} · last seen {new Date(r.last_seen + "Z").toLocaleString()}
                </div>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleForget(r.round_id); }}
                className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition"
                title="Forget this round from device">
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreateRound({ onCreated }: { onCreated: (code: string, adminToken: string) => void }) {
  const [name, setName] = useState("Sunday Round");
  const [courseId, setCourseId] = useState<string | "custom" | "">("");
  const [customCourse, setCustomCourse] = useState("");
  const [customPars, setCustomPars] = useState<number[]>(Array(18).fill(4));
  const [holes, setHoles] = useState(18);
  const [playerCount, setPlayerCount] = useState(4);
  const [dfStake, setDfStake] = useState(100);
  const [olyStake, setOlyStake] = useState(10);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  useEffect(() => {
    api.listCourses().then(c => { setCourses(c); setCoursesLoading(false); })
      .catch(() => setCoursesLoading(false));
  }, []);

  const selected = courses.find(c => c.id === courseId);
  const isCustom = courseId === "custom";

  useEffect(() => {
    if (selected) {
      setHoles(selected.hole_count);
      setCustomPars(selected.pars);
    }
  }, [selected]);

  async function submit() {
    if (!courseId) { setErr("Pick a course"); return; }
    if (isCustom && !customCourse.trim()) { setErr("Enter a course name"); return; }
    setLoading(true); setErr(null);
    try {
      const code = genCode();
      const admin_token = genToken();
      const pars = isCustom ? customPars.slice(0, holes) : (selected!.pars.slice(0, holes));
      const courseName = isCustom ? customCourse.trim() : selected!.name;

      const players = Array.from({ length: playerCount }, (_, i) => ({
        seat: i + 1,
        name: `Player ${i + 1}`,
        color: PLAYER_COLORS[i],
        player_token: genToken()
      }));

      const res = await api.createRound({
        code, name,
        course_name: courseName,
        course_id: isCustom ? null : selected!.id,
        hole_count: holes,
        player_count: playerCount,
        dog_flight_stake: dfStake,
        olympic_stake: olyStake,
        admin_token,
        pars,
        players
      });
      // Register this device as the round admin
      await trackRoundAccess({ round_id: res.id, is_admin: true, admin_token: res.admin_token });
      onCreated(res.code, res.admin_token);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <input className="input" placeholder="Round name" value={name} onChange={e => setName(e.target.value)} />

      <label className="text-white/70 text-sm block">
        Course
        <select className="input mt-1" value={courseId}
                onChange={e => setCourseId(e.target.value as any)} disabled={coursesLoading}>
          <option value="">{coursesLoading ? "Loading…" : "— pick a course —"}</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} · Par {c.total_par}
            </option>
          ))}
          <option value="custom">+ Custom course…</option>
        </select>
      </label>

      {selected && (
        <div className="bg-white/5 rounded-lg p-2.5 text-xs space-y-1">
          <div className="flex items-center gap-1 text-white/70">
            <MapPin className="w-3 h-3" />{selected.location || "—"}
          </div>
          <div className="flex flex-wrap gap-1">
            {selected.pars.map((p, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-white/5 text-white/70">
                <span className="text-white/40">{i + 1}·</span>P{p}
              </span>
            ))}
          </div>
        </div>
      )}

      {isCustom && (
        <div className="space-y-2">
          <input className="input" placeholder="Course name"
                 value={customCourse} onChange={e => setCustomCourse(e.target.value)} />
          <div>
            <div className="text-white/60 text-xs mb-1">Par per hole</div>
            <div className="grid grid-cols-9 gap-1">
              {Array.from({ length: holes }, (_, i) => (
                <div key={i} className="text-center">
                  <div className="text-white/40 text-[10px]">{i + 1}</div>
                  <select
                    value={customPars[i] ?? 4}
                    onChange={e => setCustomPars(prev => prev.map((v, j) => j === i ? Number(e.target.value) : v))}
                    className="w-full bg-white/5 border border-white/10 rounded text-white text-sm text-center py-1">
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                    <option value={6}>6</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="text-white/70 text-sm">
          Holes
          <select className="input mt-1" value={holes} onChange={e => setHoles(Number(e.target.value))}>
            <option value={9}>9</option><option value={18}>18</option>
          </select>
        </label>
        <label className="text-white/70 text-sm">
          Players
          <select className="input mt-1" value={playerCount} onChange={e => setPlayerCount(Number(e.target.value))}>
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-white/70 text-sm">
          🗡️ Dog Flight / pt (THB)
          <input className="input mt-1" type="number" min={0} value={dfStake}
                 onChange={e => setDfStake(Number(e.target.value) || 0)} />
        </label>
        <label className="text-white/70 text-sm">
          🏆 Olympic / pt (THB)
          <input className="input mt-1" type="number" min={0} value={olyStake}
                 onChange={e => setOlyStake(Number(e.target.value) || 0)} />
        </label>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      <button onClick={submit} disabled={loading} className="btn-primary w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Create round
      </button>
    </div>
  );
}

function JoinRound({ onJoined }: { onJoined: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function go() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) { setErr("Enter the round code"); return; }
    setLoading(true); setErr(null);
    try {
      const data = await api.getRound(c);
      // Register this device as a viewer of the round (auto-tracking)
      if (data?.round?.id) await trackRoundAccess({ round_id: data.round.id });
      onJoined(c);
    } catch {
      setErr("Round not found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <input
        className="input text-center tracking-[0.3em] text-2xl font-bold uppercase"
        placeholder="ABC123"
        value={code}
        maxLength={8}
        onChange={e => setCode(e.target.value.toUpperCase())}
      />
      {err && <p className="text-red-400 text-sm">{err}</p>}
      <button onClick={go} disabled={loading} className="btn-primary w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        Join round
      </button>
    </div>
  );
}
