import { type ForwardEnv, forward } from "../../lib/forward";

export const onRequest = (context: { request: Request; env: ForwardEnv }): Promise<Response> => forward(context);
