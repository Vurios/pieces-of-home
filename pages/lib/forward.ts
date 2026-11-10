/** Forwards a request, WebSocket upgrades included, to the game Worker. */
export interface ForwardEnv {
  GAME: { fetch(request: Request): Promise<Response> };
}

export function forward(context: { request: Request; env: ForwardEnv }): Promise<Response> {
  return context.env.GAME.fetch(context.request);
}
