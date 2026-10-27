import { Trash2 } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { formatBRL, monthRange, shiftMonth, todayISO } from "@/lib/format";
import { Button, Card, EmptyState, Field, Input, PageHeader, ProgressBar, Select } from "@/components/ui";
import { copyBudgets, deleteBudget, saveBudget } from "../actions";
import { MonthPicker, resolveMonth } from "../month-picker";

export const metadata = { title: "Orçamentos" };

type Budget = { id: string; amount: number; category_id: string; categories: { name: string; icon: string; color: string } };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, user } = await requireUser();
  const month = resolveMonth((await searchParams).mes, todayISO());
  const { start, end } = monthRange(month);

  const [{ data: budgets }, { data: categories }, { data: txs }] = await Promise.all([
    supabase.from("budgets").select("id, amount, category_id, categories(name, icon, color)").eq("user_id", user.id).eq("month", start),
    supabase.from("categories").select("id, name, icon").eq("user_id", user.id).eq("type", "expense").order("name"),
    supabase.from("transactions").select("category_id, amount").eq("user_id", user.id).eq("type", "expense").gte("date", start).lte("date", end),
  ]);

  const spent = new Map<string, number>();
  for (const t of txs ?? []) if (t.category_id) spent.set(t.category_id, (spent.get(t.category_id) ?? 0) + Number(t.amount));
  const list = (budgets ?? []) as unknown as Budget[];
  const totalBudget = list.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = list.reduce((s, b) => s + (spent.get(b.category_id) ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description={`Planejado ${formatBRL(totalBudget)} · Gasto ${formatBRL(totalSpent)}`}
        actions={<MonthPicker month={month} basePath="/app/orcamentos" />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {list.length ? (
            <ul className="space-y-5">
              {list.map((b) => {
                const s = spent.get(b.category_id) ?? 0;
                const pct = (s / Number(b.amount)) * 100;
                return (
                  <li key={b.id}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{b.categories.icon} {b.categories.name}</span>
                      <span className="flex items-center gap-2">
                        <span className={pct > 100 ? "font-semibold text-rose-600" : "text-slate-600"}>{formatBRL(s)} de {formatBRL(b.amount)}</span>
                        <form action={deleteBudget}>
                          <input type="hidden" name="id" value={b.id} />
                          <button className="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Remover orçamento"><Trash2 className="h-3.5 w-3.5" /></button>
                        </form>
                      </span>
                    </div>
                    <ProgressBar value={pct} color={pct > 100 ? "#e11d48" : pct > 80 ? "#f59e0b" : b.categories.color} />
                    <p className="mt-1 text-xs text-slate-500">
                      {pct > 100 ? `Estourou ${formatBRL(s - Number(b.amount))}` : `Restam ${formatBRL(Number(b.amount) - s)}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-center">
              <EmptyState>Nenhum orçamento para este mês.</EmptyState>
              <form action={copyBudgets}>
                <input type="hidden" name="from" value={shiftMonth(month, -1)} />
                <input type="hidden" name="to" value={month} />
                <Button variant="secondary">Copiar do mês anterior</Button>
              </form>
            </div>
          )}
        </Card>
        <Card className="h-fit">
          <h2 className="mb-4 font-semibold">Definir orçamento</h2>
          <form action={saveBudget} className="space-y-3">
            <input type="hidden" name="month" value={month} />
            <Field label="Categoria">
              <Select name="category_id" required>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </Select>
            </Field>
            <Field label="Limite mensal (R$)"><Input name="amount" inputMode="decimal" required /></Field>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
