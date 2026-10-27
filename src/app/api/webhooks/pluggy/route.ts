import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncBankConnection } from "@/lib/openfinance/sync";
import { requestSecret, safeEqual } from "@/lib/security/secret";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Webhook da Pluggy. Os dados do evento nunca são usados diretamente:
 * buscamos o item na própria API da Pluggy antes de gravar qualquer coisa.
 */
export async function POST(req: Request) {
  if (!safeEqual(requestSecret(req), process.env.PLUGGY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { event?: string; itemId?: string } | null;
  if (!body?.itemId) return NextResponse.json({ ok: true, ignored: true });

  const db = createAdminClient();
  if (body.event === "item/deleted") {
    await db.from("bank_connections").delete().eq("item_id", body.itemId);
    return NextResponse.json({ ok: true });
  }

  const { data: conn } = await db.from("bank_connections").select("id").eq("item_id", body.itemId).maybeSingle();
  if (!conn) return NextResponse.json({ ok: true, ignored: true });

  try {
    const result = await syncBankConnection(db, body.itemId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[pluggy webhook]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
