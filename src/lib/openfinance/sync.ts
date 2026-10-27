import type { SupabaseClient } from "@supabase/supabase-js";
import { getItem, listAccounts, listTransactions } from "./pluggy";
import { mapPluggyTransaction, resolveCategoryId } from "./mapping";

const DEFAULT_HISTORY_DAYS = 90;

function isoDaysAgo(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Sincroniza contas, cartões e transações de uma conexão (item) da Pluggy.
 * `db` deve ser o client admin; todos os writes são filtrados pelo user_id da conexão.
 */
export async function syncBankConnection(db: SupabaseClient, itemId: string) {
  const { data: conn } = await db.from("bank_connections").select("id, user_id, last_synced_at").eq("item_id", itemId).maybeSingle();
  if (!conn) throw new Error(`Conexão ${itemId} não encontrada`);
  const userId: string = conn.user_id;

  const item = await getItem(itemId);
  await db
    .from("bank_connections")
    .update({
      status: item.status,
      error_message: item.error?.message ?? null,
      institution_name: item.connector?.name,
      institution_logo: item.connector?.imageUrl ?? null,
    })
    .eq("id", conn.id);
  if (item.status !== "UPDATED") return { status: item.status, imported: 0 };

  const { data: categories } = await db.from("categories").select("id, name, type, keywords").eq("user_id", userId);
  const from = conn.last_synced_at ? isoDaysAgo(7, new Date(conn.last_synced_at)) : isoDaysAgo(DEFAULT_HISTORY_DAYS);

  let imported = 0;
  for (const acc of await listAccounts(itemId)) {
    const external_id = `pluggy:${acc.id}`;
    let target: { account_id?: string; credit_card_id?: string };

    if (acc.type === "CREDIT") {
      const { data } = await db
        .from("credit_cards")
        .upsert(
          {
            user_id: userId,
            external_id,
            bank_connection_id: conn.id,
            source: "open_finance",
            name: acc.marketingName || acc.name,
            brand: acc.creditData?.brand ?? null,
            limit_amount: acc.creditData?.creditLimit ?? 0,
            available_limit: acc.creditData?.availableCreditLimit ?? null,
            closing_day: acc.creditData?.balanceCloseDate ? new Date(acc.creditData.balanceCloseDate).getUTCDate() : 1,
            due_day: acc.creditData?.balanceDueDate ? new Date(acc.creditData.balanceDueDate).getUTCDate() : 10,
          },
          { onConflict: "user_id,external_id" },
        )
        .select("id")
        .single();
      target = { credit_card_id: data?.id };
    } else {
      const { data } = await db
        .from("accounts")
        .upsert(
          {
            user_id: userId,
            external_id,
            bank_connection_id: conn.id,
            source: "open_finance",
            name: acc.marketingName || acc.name,
            institution: item.connector?.name,
            type: acc.subtype === "SAVINGS_ACCOUNT" ? "savings" : "checking",
            synced_balance: acc.balance,
          },
          { onConflict: "user_id,external_id" },
        )
        .select("id")
        .single();
      target = { account_id: data?.id };
    }

    const rows = (await listTransactions(acc.id, from))
      .map((tx) => mapPluggyTransaction(tx, acc.type))
      .filter((m) => m !== null)
      .map((m) => ({
        user_id: userId,
        type: m.type,
        amount: m.amount,
        description: m.description,
        date: m.date,
        category_id: resolveCategoryId(m, categories ?? []),
        source: "open_finance",
        external_id: m.external_id,
        ...target,
      }));

    // ignoreDuplicates: não sobrescreve edições que o usuário fez em lançamentos já importados.
    for (let i = 0; i < rows.length; i += 500) {
      const { error, count } = await db
        .from("transactions")
        .upsert(rows.slice(i, i + 500), { onConflict: "user_id,external_id", ignoreDuplicates: true, count: "exact" });
      if (error) throw error;
      imported += count ?? 0;
    }
  }

  await db.from("bank_connections").update({ last_synced_at: new Date().toISOString() }).eq("id", conn.id);
  return { status: item.status, imported };
}
