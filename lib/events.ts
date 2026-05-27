// In-memory pub/sub for realtime dashboard updates over SSE.
// One process == single source of truth, which is fine for a Sunday-golf app.
import { EventEmitter } from "node:events";

declare global {
  // eslint-disable-next-line no-var
  var __golf_bus: EventEmitter | undefined;
}

export const bus: EventEmitter = global.__golf_bus ?? (() => {
  const e = new EventEmitter();
  e.setMaxListeners(200);
  global.__golf_bus = e;
  return e;
})();

export type RoundEvent = {
  table: "rounds" | "players" | "holes" | "scores";
  type: "INSERT" | "UPDATE" | "DELETE";
  row: any;
};

export function emitRoundEvent(roundId: string, ev: RoundEvent) {
  bus.emit(`round:${roundId}`, ev);
}

export function onRoundEvent(roundId: string, fn: (ev: RoundEvent) => void) {
  const channel = `round:${roundId}`;
  bus.on(channel, fn);
  return () => bus.off(channel, fn);
}
