"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseMoney } from "@/lib/format";
import { deleteItem } from "@/lib/openfinance/pluggy";
import { syncBankConnection } from "@/lib/openfinance/sync";

const money = z.string().transform((v, ctx) => {
  const n = parseMoney(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: "Valor inválido" });
    return z.NEVER;
  }
  return n;
});
const signedMoney = z.string().transform((v) => {
  const neg = v.trim().startsWith("-");
  const n = parseMoney(v.replace("-", "")) ?? 0;
  return neg ? -n : n;
});
const optionalId = z.string().transform((v) => (v ? v : null)).pipe(z.string().uuid().nullable());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).catch("#10b981");
const day = z.coerce.number().int().min(1).max(31);

function form(fd: FormData) {
  return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
}

function fail(message: string): never {
  throw new Error(message);
}

// ---------------------------------------------------------------- Lançamentos
const txSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: money,
  description: z.string().trim().min(1).max(200),
  date,
  category_id: optionalId,
  destination: z.string(),
  paid: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

function txPayload(data: z.infer<typeof txSchema>) {
  const [kind, id] = data.destination.split(":");
  const valid = id && /^[0-9a-f-]{36}$/.test(id);
  return {
    type: data.type,
    amount: data.amount,
    description: data.description,
    date: data.date,
    category_id: data.category_id,
    account_id: kind === "account" && valid ? id : null,
    credit_card_id: kind === "card" && valid ? id : null,
    paid: data.paid === "on",
    notes: data.notes?.trim() || null,
  };
}

export async function saveTransaction(fd: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = txSchema.safeParse(form(fd));
  if (!parsed.success) fail("Verifique os campos do lançamento.");
  const id = fd.get("id");
  const payload = txPayload(parsed.data);
  const { error } = id
    ? await supabase.from("transactions").update(payload).eq("id", String(id)).eq("user_id", user.id)
    : await supabase.from("transactions").insert({ ...payload, user_id: user.id });
  if (error) fail(error.message);
  revalidatePath("/app", "layout");
  redirect(`/app/transacoes?mes=${parsed.data.date.slice(0, 7)}`);
}

export async function deleteTransaction(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("transactions").delete().eq("id", String(fd.get("id"))).eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

// ---------------------------------------------------------------- Contas e cartões
export async function saveAccount(fd: FormData) {
  const { supabase, user } = await requireUser();
  const data = z
    .object({
      name: z.string().trim().min(1).max(80),
      type: z.enum(["checking", "savings", "wallet", "investment", "other"]),
      institution: z.string().max(80).optional(),
      initial_balance: signedMoney,
      color,
    })
    .parse(form(fd));
  const { error } = await supabase.from("accounts").insert({ ...data, institution: data.institution || null, user_id: user.id });
  if (error) fail(error.message);
  revalidatePath("/app", "layout");
}

export async function archiveAccount(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("accounts").update({ is_archived: true }).eq("id", String(fd.get("id"))).eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

export async function saveCard(fd: FormData) {
  const { supabase, user } = await requireUser();
  const data = z
    .object({
      name: z.string().trim().min(1).max(80),
      brand: z.string().max(40).optional(),
      limit_amount: money,
      closing_day: day,
      due_day: day,
      color,
    })
    .parse(form(fd));
  const { error } = await supabase.from("credit_cards").insert({ ...data, brand: data.brand || null, user_id: user.id });
  if (error) fail(error.message);
  revalidatePath("/app", "layout");
}

export async function archiveCard(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("credit_cards").update({ is_archived: true }).eq("id", String(fd.get("id"))).eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

// ---------------------------------------------------------------- Categorias
export async function saveCategory(fd: FormData) {
  const { supabase, user } = await requireUser();
  const data = z
    .object({
      name: z.string().trim().min(1).max(60),
      type: z.enum(["income", "expense"]),
      icon: z.string().trim().max(8).catch("🏷️"),
      color,
      keywords: z.string().max(500).optional(),
    })
    .parse(form(fd));
  const keywords = (data.keywords ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const { error } = await supabase
    .from("categories")
    .insert({ ...data, icon: data.icon || "🏷️", keywords, user_id: user.id });
  if (error) fail(error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message);
  revalidatePath("/app", "layout");
}

export async function deleteCategory(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("categories").delete().eq("id", String(fd.get("id"))).eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

// ---------------------------------------------------------------- Orçamentos
export async function saveBudget(fd: FormData) {
  const { supabase, user } = await requireUser();
  const data = z
    .object({ category_id: z.string().uuid(), amount: money, month: z.string().regex(/^\d{4}-\d{2}$/) })
    .parse(form(fd));
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { user_id: user.id, category_id: data.category_id, amount: data.amount, month: `${data.month}-01` },
      { onConflict: "user_id,category_id,month" },
    );
  if (error) fail(error.message);
  revalidatePath("/app", "layout");
}

export async function deleteBudget(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("budgets").delete().eq("id", String(fd.get("id"))).eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

export async function copyBudgets(fd: FormData) {
  const { supabase, user } = await requireUser();
  const { from, to } = z.object({ from: z.string().regex(/^\d{4}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}$/) }).parse(form(fd));
  const { data } = await supabase.from("budgets").select("category_id, amount").eq("user_id", user.id).eq("month", `${from}-01`);
  if (data?.length) {
    await supabase
      .from("budgets")
      .upsert(
        data.map((b) => ({ ...b, user_id: user.id, month: `${to}-01` })),
        { onConflict: "user_id,category_id,month", ignoreDuplicates: true },
      );
  }
  revalidatePath("/app", "layout");
}

// ---------------------------------------------------------------- Metas
export async function saveGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  const data = z
    .object({
      name: z.string().trim().min(1).max(80),
      target_amount: money,
      current_amount: z.string().transform((v) => parseMoney(v) ?? 0),
      deadline: z.string().transform((v) => v || null).pipe(date.nullable()),
      color,
    })
    .parse(form(fd));
  const { error } = await supabase.from("goals").insert({ ...data, user_id: user.id });
  if (error) fail(error.message);
  revalidatePath("/app", "layout");
}

export async function contributeGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  const { id, amount } = z.object({ id: z.string().uuid(), amount: signedMoney }).parse(form(fd));
  const { data: goal } = await supabase.from("goals").select("current_amount").eq("id", id).eq("user_id", user.id).single();
  if (!goal) fail("Meta não encontrada.");
  await supabase
    .from("goals")
    .update({ current_amount: Math.max(0, Number(goal.current_amount) + amount) })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

export async function deleteGoal(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("goals").delete().eq("id", String(fd.get("id"))).eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

// ---------------------------------------------------------------- Perfil e WhatsApp
export async function updateProfile(fd: FormData) {
  const { supabase, user } = await requireUser();
  const full_name = z.string().trim().max(120).parse(fd.get("full_name") ?? "");
  await supabase.from("profiles").update({ full_name }).eq("id", user.id);
  revalidatePath("/app", "layout");
}

/** Gera um código de 6 dígitos (válido por 15 min) para vincular o WhatsApp. */
export async function generateWhatsAppCode() {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const code = String(randomInt(100000, 1000000));
  await admin
    .from("profiles")
    .update({ whatsapp_link_code: code, whatsapp_link_code_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
    .eq("id", user.id);
  revalidatePath("/app/whatsapp");
}

export async function unlinkWhatsApp() {
  const { user } = await requireUser();
  await createAdminClient().from("profiles").update({ phone: null, whatsapp_linked_at: null }).eq("id", user.id);
  revalidatePath("/app/whatsapp");
}

// ---------------------------------------------------------------- Open Finance
async function ownConnection(id: string) {
  const { supabase } = await requireUser();
  // RLS garante que só retorna conexões do usuário logado.
  const { data } = await supabase.from("bank_connections").select("id, item_id").eq("id", id).maybeSingle();
  if (!data) fail("Conexão não encontrada.");
  return data;
}

export async function syncConnection(fd: FormData) {
  const conn = await ownConnection(String(fd.get("id")));
  await syncBankConnection(createAdminClient(), conn.item_id);
  revalidatePath("/app", "layout");
}

export async function removeConnection(fd: FormData) {
  const conn = await ownConnection(String(fd.get("id")));
  await deleteItem(conn.item_id).catch(() => undefined);
  const admin = createAdminClient();
  // Mantém o histórico de lançamentos, mas remove contas e cartões vinculados (cascade).
  await admin.from("bank_connections").delete().eq("id", conn.id);
  revalidatePath("/app", "layout");
}
