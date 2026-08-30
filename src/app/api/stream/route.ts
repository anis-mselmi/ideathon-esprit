import { subscribe, AppEvent } from "@/lib/events";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream. Owners receive fleet-wide events; clients receive
 * only their own notifications.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let ping: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: AppEvent) => {
        // Authorization filter: clients only see their notifications.
        if (session.role !== "OWNER") {
          if (e.type !== "notification" || e.userId !== session.id) return;
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* stream closed */
        }
      };
      controller.enqueue(encoder.encode(`: connected\n\n`));
      unsub = subscribe(send);
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* ignore */
        }
      }, 25000);
    },
    cancel() {
      unsub?.();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
