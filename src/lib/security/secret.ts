import { timingSafeEqual } from "node:crypto";

/** Compara segredos em tempo constante. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Lê o segredo do header Authorization (Bearer), de um header próprio ou de ?token=. */
export function requestSecret(req: Request, header = "x-webhook-secret"): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.headers.get(header) ?? new URL(req.url).searchParams.get("token");
}
