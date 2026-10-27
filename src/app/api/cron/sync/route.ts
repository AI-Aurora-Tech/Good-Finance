import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshItem } from "@/lib/openfinance/pluggy";
import { syncBankConnection } from "@/lib/openfinance/sync";
import { requestSecret, safeEqual } from "@/lib/security/secret";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Executado diariamente pela Vercel Cron (ver vercel.json).
 * A Vercel envia "Authorization: Bearer CRON_SECRET".
 */
export async function GET(req: Request) {
  if (!safeEqual(requestSecret(req), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: connections } = await db.from("bank_connections").select("item_id");
  const results: Array<{ itemId: string; ok: boolean }> = [];

  for (const { item_id } of connections ?? []) {
    try {
      // Importa o que já está disponível e pede nova coleta ao banco (o resultado chega pelo webhook).
      await syncBankConnection(db, item_id);
      await refreshItem(item_id).catch(() => undefined);
      results.push({ itemId: item_id, ok: true });
    } catch (err) {
      console.error("[cron sync]", item_id, err);
      results.push({ itemId: item_id, ok: false });
    }
  }
  return NextResponse.json({ synced: results.length, results });
}
