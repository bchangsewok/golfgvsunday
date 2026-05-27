import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { onRoundEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const round = db.prepare("SELECT id FROM rounds WHERE code = ?").get(params.code.toUpperCase()) as any;
  if (!round) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();

  // Shared closure state so `cancel` can reach what `start` created.
  let closed = false;
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try { controller.enqueue(chunk); }
        catch { /* downstream gone — let cancel() run on next tick */ }
      };
      const send = (data: any) =>
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      send({ hello: true });

      const ping = setInterval(() => safeEnqueue(encoder.encode(`: ping\n\n`)), 25_000);
      const off  = onRoundEvent(round.id, ev => send(ev));

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        off();
        try { controller.close(); } catch {}
      };
    },
    cancel() { cleanup(); }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
