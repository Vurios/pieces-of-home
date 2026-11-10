import { routePartykitRequest } from "partyserver";
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

    if (url.pathname.startsWith("/parties/")) {
      const response = await routePartykitRequest(request, env);
      if (response) return response;
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
