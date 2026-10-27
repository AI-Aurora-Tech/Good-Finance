import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBRL, formatDate, monthRange, todayISO } from "@/lib/format";
import { matchCategory, normalize, parseMessage } from "./parser";
import { phoneVariants } from "./phone";

export const HELP_TEXT = [
  "👋 *Good Finance* — seu assistente financeiro",
  "",
  "Registre gastos e receitas escrevendo naturalmente:",
  "• _gastei 50 no mercado_",
  "• _uber 23,90 ontem_",
  "• _recebi 3000 de salário_",
  "• _paguei 120 de luz no cartão nubank_",
  "",
  "Comandos:",
  "• *saldo* — saldo das contas",
  "• *resumo* — receitas e despesas do mês",
  "• *extrato* — últimos lançamentos",
  "• *metas* — progresso das metas",
  "• *categorias* — suas categorias",
  "• *desfazer* — apaga o último lançamento",
].join("\n");

type Profile = { id: string; full_name: string | null };

/**
 * Processa uma mensagem recebida e retorna o texto da resposta.
 * Usa o client admin (service role), por isso SEMPRE filtra por user_id.
 */
export async function handleIncomingMessage(db: SupabaseClient, phone: string, text: string): Promise<{ reply: string; userId?: string }> {
  const parsed = parseMessage(text);

  // Vinculação do número: "vincular 123456"
  if (parsed.kind === "command" && parsed.command === "link") {
    const { data: profile } = await db
      .from("profiles")
      .select("id, full_name, whatsapp_link_code_expires_at")
      .eq("whatsapp_link_code", parsed.arg)
      .maybeSingle();
    if (!profile || !profile.whatsapp_link_code_expires_at || new Date(profile.whatsapp_link_code_expires_at) < new Date()) {
      return { reply: "❌ Código inválido ou expirado. Gere um novo código em *Good Finance → WhatsApp*." };
    }
    // Desvincula o número de qualquer outra conta antes de vincular.
    await db.from("profiles").update({ phone: null }).in("phone", phoneVariants(phone));
    const { error } = await db
      .from("profiles")
      .update({ phone, whatsapp_link_code: null, whatsapp_link_code_expires_at: null, whatsapp_linked_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) return { reply: "❌ Não consegui vincular agora. Tente novamente em instantes." };
    const name = profile.full_name?.split(" ")[0];
    return { reply: `✅ Pronto${name ? `, ${name}` : ""}! Seu WhatsApp está conectado ao Good Finance.\n\n${HELP_TEXT}`, userId: profile.id };
  }

  const { data: profile } = await db
    .from("profiles")
    .select("id, full_name")
    .in("phone", phoneVariants(phone))
    .limit(1)
    .maybeSingle<Profile>();

  if (!profile) {
    return {
      reply:
        "Olá! 👋 Este número ainda não está conectado ao *Good Finance*.\n\nEntre no app, abra *WhatsApp* no menu e envie aqui o código mostrado (ex: _vincular 123456_).",
    };
  }
  const userId = profile.id;

  if (parsed.kind === "unknown") {
    return { userId, reply: "🤔 Não entendi. Tente algo como _gastei 30 no almoço_ ou envie *ajuda*." };
  }

  if (parsed.kind === "command") {
    switch (parsed.command) {
      case "balance":
        return { userId, reply: await balanceReply(db, userId) };
      case "summary":
        return { userId, reply: await summaryReply(db, userId) };
      case "statement":
        return { userId, reply: await statementReply(db, userId) };
      case "undo":
        return { userId, reply: await undoReply(db, userId) };
      case "categories":
        return { userId, reply: await categoriesReply(db, userId) };
      case "goals":
        return { userId, reply: await goalsReply(db, userId) };
      default:
        return { userId, reply: HELP_TEXT };
    }
  }

  // Lançamento
  const [{ data: categories }, { data: accounts }, { data: cards }] = await Promise.all([
    db.from("categories").select("id, name, type, keywords, icon").eq("user_id", userId),
    db.from("accounts").select("id, name, type").eq("user_id", userId).eq("is_archived", false).order("created_at"),
    db.from("credit_cards").select("id, name").eq("user_id", userId).eq("is_archived", false),
  ]);

  const normText = ` ${normalize(text)} `;
  const card = (cards ?? []).find((c) => normText.includes(` ${normalize(c.name)} `)) ??
    (/\s(cartao|credito)\s/.test(normText) && cards?.length === 1 ? cards[0] : undefined);
  const account = card
    ? undefined
    : (accounts ?? []).find((a) => normText.includes(` ${normalize(a.name)} `)) ??
      (accounts ?? []).find((a) => a.type === "wallet") ??
      accounts?.[0];
  const category = matchCategory(parsed.description, parsed.type, categories ?? []) ??
    matchCategory(text, parsed.type, categories ?? []);

  const date = new Date(`${todayISO()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - parsed.daysAgo);
  const isoDate = date.toISOString().slice(0, 10);

  const { data: tx, error } = await db
    .from("transactions")
    .insert({
      user_id: userId,
      type: parsed.type,
      amount: parsed.amount,
      description: parsed.description,
      date: isoDate,
      category_id: category?.id ?? null,
      account_id: account?.id ?? null,
      credit_card_id: card?.id ?? null,
      source: "whatsapp",
    })
    .select("id")
    .single();
  if (error || !tx) return { userId, reply: "❌ Não consegui registrar agora. Tente novamente." };

  const emoji = parsed.type === "income" ? "💰" : "💸";
  const where = card ? `💳 ${card.name}` : account ? `🏦 ${account.name}` : "";
  return {
    userId,
    reply: [
      `${emoji} *${parsed.type === "income" ? "Receita" : "Despesa"} registrada!*`,
      `${parsed.description} — *${formatBRL(parsed.amount)}*`,
      `${category ? `${category.icon} ${category.name}` : "🏷️ Sem categoria"}${where ? ` · ${where}` : ""}`,
      `📅 ${formatDate(isoDate)}`,
      "",
      "_Errou? Envie *desfazer*._",
    ].join("\n"),
  };
}

async function balanceReply(db: SupabaseClient, userId: string) {
  const { data } = await db.from("account_balances").select("name, balance").eq("user_id", userId).eq("is_archived", false);
  if (!data?.length) return "Você ainda não tem contas cadastradas.";
  const total = data.reduce((s, a) => s + Number(a.balance), 0);
  return ["🏦 *Saldos*", ...data.map((a) => `• ${a.name}: ${formatBRL(a.balance)}`), "", `*Total: ${formatBRL(total)}*`].join("\n");
}

async function summaryReply(db: SupabaseClient, userId: string) {
  const { start, end } = monthRange(todayISO());
  const { data } = await db
    .from("transactions")
    .select("type, amount, categories(name, icon)")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);
  const rows = (data ?? []) as unknown as Array<{ type: string; amount: number; categories: { name: string; icon: string } | null }>;
  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const byCat = new Map<string, number>();
  for (const r of rows.filter((r) => r.type === "expense")) {
    const key = r.categories ? `${r.categories.icon} ${r.categories.name}` : "🏷️ Sem categoria";
    byCat.set(key, (byCat.get(key) ?? 0) + Number(r.amount));
  }
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return [
    "📊 *Resumo do mês*",
    `💰 Receitas: ${formatBRL(income)}`,
    `💸 Despesas: ${formatBRL(expense)}`,
    `${income - expense >= 0 ? "✅" : "⚠️"} Resultado: *${formatBRL(income - expense)}*`,
    ...(top.length ? ["", "*Maiores gastos:*", ...top.map(([k, v]) => `• ${k}: ${formatBRL(v)}`)] : []),
  ].join("\n");
}

async function statementReply(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("transactions")
    .select("type, amount, description, date")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);
  if (!data?.length) return "Nenhum lançamento ainda. Envie algo como _gastei 20 no lanche_.";
  return [
    "🧾 *Últimos lançamentos*",
    ...data.map((t) => `${t.type === "income" ? "🟢" : "🔴"} ${formatDate(t.date).slice(0, 5)} ${t.description} — ${formatBRL(t.amount)}`),
  ].join("\n");
}

async function undoReply(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("transactions")
    .select("id, description, amount")
    .eq("user_id", userId)
    .eq("source", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return "Não há lançamentos do WhatsApp para desfazer.";
  await db.from("transactions").delete().eq("id", data.id).eq("user_id", userId);
  return `🗑️ Lançamento removido: ${data.description} — ${formatBRL(data.amount)}`;
}

async function categoriesReply(db: SupabaseClient, userId: string) {
  const { data } = await db.from("categories").select("name, icon, type").eq("user_id", userId).order("name");
  const list = (type: string) => (data ?? []).filter((c) => c.type === type).map((c) => `${c.icon} ${c.name}`).join("\n");
  return `*Despesas*\n${list("expense")}\n\n*Receitas*\n${list("income")}`;
}

async function goalsReply(db: SupabaseClient, userId: string) {
  const { data } = await db.from("goals").select("name, target_amount, current_amount").eq("user_id", userId);
  if (!data?.length) return "Você ainda não tem metas. Crie uma no app em *Metas* 🎯";
  return [
    "🎯 *Metas*",
    ...data.map((g) => {
      const pct = Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100));
      return `• ${g.name}: ${formatBRL(g.current_amount)} de ${formatBRL(g.target_amount)} (${pct}%)`;
    }),
  ].join("\n");
}
