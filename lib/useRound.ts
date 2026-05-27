"use client";
import { useEffect, useState } from "react";
import { api, subscribeRound } from "./api";
import type { Round, Player, Hole, Score } from "./types";

export function useRound(code: string) {
  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    (async () => {
      try {
        const data = await api.getRound(code);
        if (cancelled) return;
        setRound(data.round);
        setPlayers(data.players);
        setHoles(data.holes);
        setScores(data.scores);
        setLoading(false);

        unsub = subscribeRound(code, ev => {
          if (ev.table === "scores") setScores(prev => applyChange(prev, ev));
          else if (ev.table === "players") setPlayers(prev => applyChange(prev, ev) as Player[]);
          else if (ev.table === "holes") setHoles(prev => applyChange(prev, ev) as Hole[]);
          else if (ev.table === "rounds") setRound(ev.row);
        });
      } catch (e: any) {
        setErr(e?.message || "Round not found");
        setLoading(false);
      }
    })();

    return () => { cancelled = true; unsub?.(); };
  }, [code]);

  return { round, players, holes, scores, loading, err, setScores };
}

function applyChange<T extends { id: string }>(arr: T[], ev: { type: string; row: any }): T[] {
  if (ev.type === "DELETE") return arr.filter(x => x.id !== ev.row.id);
  if (ev.type === "INSERT") {
    if (arr.some(x => x.id === ev.row.id)) return arr.map(x => x.id === ev.row.id ? ev.row : x);
    return [...arr, ev.row];
  }
  return arr.map(x => x.id === ev.row.id ? ev.row : x);
}
