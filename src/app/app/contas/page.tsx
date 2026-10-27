import { Archive } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { formatBRL, monthRange, todayISO } from "@/lib/format";
import { Button, Card, EmptyState, Field, Input, PageHeader, ProgressBar, Select } from "@/components/ui";
import { ACCOUNT_TYPES, type Account, type CreditCard } from "@/lib/types";
import { archiveAccount, archiveCard, saveAccount, saveCard } from "../actions";

export const metadata = { title: "Contas e cartões" };

export default async function AccountsPage() {
  const { supabase, user } = await requireUser();
  const { start, end } = monthRange(todayISO());
  const [{ data: accounts }, { data: cards }, { data: cardTx }] = await Promise.all([
    supabase.from("account_balances").select("*").eq("user_id", user.id).eq("is_archived", false).order("created_at"),
    supabase.from("credit_cards").select("*").eq("user_id", user.id).eq("is_archived", false).order("created_at"),
    supabase
      .from("transactions")
      .select("credit_card_id, amount")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .not("credit_card_id", "is", null)
      .gte("date", start)
      .lte("date", end),
  ]);

  const spentByCard = new Map<string, number>();
  for (const t of cardTx ?? []) spentByCard.set(t.credit_card_id!, (spentByCard.get(t.credit_card_id!) ?? 0) + Number(t.amount));
  const total = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0);

  return (
    <>
      <PageHeader title="Contas e cartões" description={`Saldo total: ${formatBRL(total)}`} />

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="font-semibold">Contas</h2>
          {(accounts as Account[] | null)?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(accounts as Account[]).map((a) => (
                <Card key={a.id} className="border-l-4" style={{ borderLeftColor: a.color }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-xs text-slate-500">
                        {ACCOUNT_TYPES[a.type]}{a.institution ? ` · ${a.institution}` : ""}{a.source === "open_finance" ? " · Open Finance" : ""}
                      </p>
                    </div>
                    {a.source === "manual" && (
                      <form action={archiveAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Arquivar conta"><Archive className="h-4 w-4" /></button>
                      </form>
                    )}
                  </div>
                  <p className={`mt-3 text-xl font-bold ${Number(a.balance) < 0 ? "text-rose-600" : ""}`}>{formatBRL(a.balance)}</p>
                </Card>
              ))}
            </div>
          ) : (
            <Card><EmptyState>Nenhuma conta cadastrada.</EmptyState></Card>
          )}
        </div>
        <Card>
          <h2 className="mb-4 font-semibold">Nova conta</h2>
          <form action={saveAccount} className="space-y-3">
            <Field label="Nome"><Input name="name" required placeholder="Ex: Nubank" /></Field>
            <Field label="Tipo">
              <Select name="type" defaultValue="checking">
                {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Instituição"><Input name="institution" /></Field>
            <Field label="Saldo inicial (R$)"><Input name="initial_balance" inputMode="decimal" defaultValue="0" /></Field>
            <Field label="Cor"><Input name="color" type="color" defaultValue="#10b981" className="h-10 p-1" /></Field>
            <Button type="submit" className="w-full">Adicionar conta</Button>
          </form>
        </Card>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="font-semibold">Cartões de crédito</h2>
          {(cards as CreditCard[] | null)?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(cards as CreditCard[]).map((c) => {
                const spent = spentByCard.get(c.id) ?? 0;
                const used = c.available_limit != null ? Number(c.limit_amount) - Number(c.available_limit) : spent;
                const pct = Number(c.limit_amount) ? (used / Number(c.limit_amount)) * 100 : 0;
                return (
                  <Card key={c.id} className="text-white" style={{ background: `linear-gradient(135deg, ${c.color}, #0f172a)` }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">💳 {c.name}</p>
                        <p className="text-xs opacity-80">{c.brand ?? "Cartão"} · fecha dia {c.closing_day} · vence dia {c.due_day}</p>
                      </div>
                      {c.source === "manual" && (
                        <form action={archiveCard}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="rounded-md p-1.5 opacity-70 hover:bg-white/10" aria-label="Arquivar cartão"><Archive className="h-4 w-4" /></button>
                        </form>
                      )}
                    </div>
                    <p className="mt-4 text-xs opacity-80">Gastos no mês</p>
                    <p className="text-xl font-bold">{formatBRL(spent)}</p>
                    <div className="mt-3"><ProgressBar value={pct} color="#ffffff" /></div>
                    <p className="mt-1 text-xs opacity-80">Limite usado {formatBRL(used)} de {formatBRL(c.limit_amount)}</p>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card><EmptyState>Nenhum cartão cadastrado.</EmptyState></Card>
          )}
        </div>
        <Card>
          <h2 className="mb-4 font-semibold">Novo cartão</h2>
          <form action={saveCard} className="space-y-3">
            <Field label="Nome"><Input name="name" required placeholder="Ex: Nubank" /></Field>
            <Field label="Bandeira"><Input name="brand" placeholder="Visa, Master…" /></Field>
            <Field label="Limite (R$)"><Input name="limit_amount" inputMode="decimal" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fechamento"><Input name="closing_day" type="number" min={1} max={31} defaultValue={1} /></Field>
              <Field label="Vencimento"><Input name="due_day" type="number" min={1} max={31} defaultValue={10} /></Field>
            </div>
            <Field label="Cor"><Input name="color" type="color" defaultValue="#6366f1" className="h-10 p-1" /></Field>
            <Button type="submit" className="w-full">Adicionar cartão</Button>
          </form>
        </Card>
      </section>
    </>
  );
}
