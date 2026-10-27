import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getItem } from "@/lib/openfinance/pluggy";
import { syncBankConnection } from "@/lib/openfinance/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Registra um item criado pelo widget e faz a primeira sincronização. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: string };
  if (!itemId) return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 });

  // Confirma na Pluggy que o item foi criado por este usuário.
  const item = await getItem(itemId).catch(() => null);
  if (!item || item.clientUserId !== user.id) {
    return NextResponse.json({ error: "Conexão inválida" }, { status: 403 });
  }

  const db = createAdminClient();
  const { data: existing } = await db.from("bank_connections").select("user_id").eq("item_id", itemId).maybeSingle();
  if (existing && existing.user_id !== user.id) return NextResponse.json({ error: "Conexão inválida" }, { status: 403 });
  if (!existing) {
    const { error } = await db.from("bank_connections").insert({
      user_id: user.id,
      item_id: itemId,
      institution_name: item.connector?.name,
      institution_logo: item.connector?.imageUrl ?? null,
      status: item.status,
    });
    if (error) return NextResponse.json({ error: "Falha ao salvar a conexão" }, { status: 500 });
  }

  try {
    const result = await syncBankConnection(db, itemId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[items sync]", err);
    // A conexão foi salva; o webhook/cron completa a sincronização depois.
    return NextResponse.json({ ok: true, pending: true });
  }
}
