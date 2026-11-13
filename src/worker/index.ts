import { routePartykitRequest } from "partyserver";
import { isValidRoomCode } from "../net/protocol";
import { makeRoomCode } from "../net/words";
import { Room } from "./room";

export { Room };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, name: "pieces-of-home", version: __APP_VERSION__, time: new Date().toISOString() });
    }

    // A new private room code. Rooms are never listed; only people with the code can join.
    if (url.pathname === "/api/room" && request.method === "POST") {
      const random = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
      return json({ ok: true, code: makeRoomCode(random) });
    }

    if (url.pathname.startsWith("/parties/")) {
      // Only real room codes reach a Durable Object, so stray links cost nothing.
      const code = url.pathname.split("/")[3] ?? "";
      if (!isValidRoomCode(code)) return json({ ok: false, error: "bad_room" }, 404);
      const response = await routePartykitRequest(request, env);
      if (response) return response;
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
