import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createConnectToken } from "@/lib/openfinance/pluggy";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Gera o token que abre o widget Pluggy Connect para o usuário logado. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: string };
  if (itemId) {
    // Reconexão: o item precisa pertencer ao usuário.
    const { data } = await supabase.from("bank_connections").select("id").eq("item_id", itemId).maybeSingle();
    if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  const webhookUrl = appUrl().startsWith("https://") && secret ? `${appUrl()}/api/webhooks/pluggy?token=${encodeURIComponent(secret)}` : undefined;

  try {
    const { accessToken } = await createConnectToken({ itemId, clientUserId: user.id, webhookUrl });
    return NextResponse.json({ accessToken });
  } catch (err) {
    console.error("[connect-token]", err);
    return NextResponse.json({ error: "Não foi possível iniciar a conexão com o banco." }, { status: 502 });
  }
}
