import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractIncomingText, sendWhatsAppText, type EvolutionWebhook } from "@/lib/whatsapp/evolution";
import { handleIncomingMessage } from "@/lib/whatsapp/handler";
import { jidToPhone } from "@/lib/whatsapp/phone";
import { requestSecret, safeEqual } from "@/lib/security/secret";

export const dynamic = "force-dynamic";

/**
 * Webhook da Evolution API (evento MESSAGES_UPSERT).
 * Configure na Evolution: URL = https://SEU_DOMINIO/api/webhooks/evolution?token=EVOLUTION_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  if (!safeEqual(requestSecret(req), process.env.EVOLUTION_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as EvolutionWebhook | null;
  const incoming = payload ? extractIncomingText(payload) : null;
  if (!incoming) return NextResponse.json({ ok: true, ignored: true });

  const phone = jidToPhone(incoming.jid);
  const db = createAdminClient();

  try {
    const { reply, userId } = await handleIncomingMessage(db, phone, incoming.text);
    await db.from("whatsapp_messages").insert([
      { user_id: userId ?? null, phone, direction: "in", body: incoming.text.slice(0, 2000) },
      { user_id: userId ?? null, phone, direction: "out", body: reply.slice(0, 2000) },
    ]);
    await sendWhatsAppText(phone, reply);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[evolution webhook]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
