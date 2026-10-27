import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, CreditCard, Wallet } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { formatBRL, formatDate, monthLabel, monthRange, shiftMonth, todayISO } from "@/lib/format";
import { Card, PageHeader, ProgressBar, ButtonLink, EmptyState } from "@/components/ui";
import type { Transaction } from "@/lib/types";
import { CategoryPie, MonthlyBars } from "./charts";
import { MonthPicker, resolveMonth } from "./month-picker";

export const metadata = { title: "Painel" };

type Row = Pick<Transaction, "type" | "amount" | "date" | "category_id" | "credit_card_id"> & { categories: Transaction["categories"] };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase, user } = await requireUser();
  const month = resolveMonth((await searchParams).mes, todayISO());
  const { start, end } = monthRange(month);
  const sixMonthsStart = monthRange(shiftMonth(month, -5)).start;

  const [{ data: history }, { data: balances }, { data: recent }, { data: budgets }, { data: profile }] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, date, category_id, credit_card_id, categories(name, icon, color)")
      .eq("user_id", user.id)
      .gte("date", sixMonthsStart)
      .lte("date", end),
    supabase.from("account_balances").select("balance").eq("user_id", user.id).eq("is_archived", false),
    supabase
      .from("transactions")
      .select("id, type, amount, description, date, categories(name, icon, color)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("budgets").select("id, amount, category_id, categories(name, icon, color)").eq("user_id", user.id).eq("month", start),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
  ]);

  const rows = (history ?? []) as unknown as Row[];
  const monthRows = rows.filter((r) => r.date >= start && r.date <= end);
  const sum = (list: Row[], type: string) => list.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount), 0);
  const income = sum(monthRows, "income");
  const expense = sum(monthRows, "expense");
  const cardSpend = monthRows.filter((r) => r.type === "expense" && r.credit_card_id).reduce((s, r) => s + Number(r.amount), 0);
  const totalBalance = (balances ?? []).reduce((s, a) => s + Number(a.balance), 0);

  const byCategory = new Map<string, { name: string; value: number; color: string }>();
  const spentByCategoryId = new Map<string, number>();
  for (const r of monthRows.filter((r) => r.type === "expense")) {
    const name = r.categories ? `${r.categories.icon} ${r.categories.name}` : "Sem categoria";
    const entry = byCategory.get(name) ?? { name, value: 0, color: r.categories?.color ?? "#94a3b8" };
    entry.value += Number(r.amount);
    byCategory.set(name, entry);
    if (r.category_id) spentByCategoryId.set(r.category_id, (spentByCategoryId.get(r.category_id) ?? 0) + Number(r.amount));
  }
  const pieData = [...byCategory.values()].sort((a, b) => b.value - a.value);

  const bars = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(month, i - 5);
    const r = monthRange(m);
    const list = rows.filter((x) => x.date >= r.start && x.date <= r.end);
    return { month: monthLabel(m).slice(0, 3), Receitas: sum(list, "income"), Despesas: sum(list, "expense") };
  });

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Olá, ${firstName}!` : "Painel"}
        description="Visão geral das suas finanças"
        actions={
          <>
            <MonthPicker month={month} basePath="/app" />
            <ButtonLink href="/app/transacoes?novo=1">+ Novo lançamento</ButtonLink>
          </>
        }
      />

      {!profile?.phone && (
        <Link href="/app/whatsapp" className="mb-6 block rounded-2xl bg-brand-50 p-4 text-sm text-brand-900 ring-1 ring-brand-100">
          💬 <b>Conecte seu WhatsApp</b> e registre gastos mandando uma mensagem. Clique para configurar.
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Wallet className="h-5 w-5 text-slate-500" />} label="Saldo em contas" value={formatBRL(totalBalance)} />
        <Stat icon={<ArrowUpCircle className="h-5 w-5 text-emerald-500" />} label="Receitas do mês" value={formatBRL(income)} tone="text-emerald-600" />
        <Stat icon={<ArrowDownCircle className="h-5 w-5 text-rose-500" />} label="Despesas do mês" value={formatBRL(expense)} tone="text-rose-600" />
        <Stat icon={<CreditCard className="h-5 w-5 text-indigo-500" />} label="Gasto no cartão" value={formatBRL(cardSpend)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-semibold">Receitas x despesas</h2>
          <MonthlyBars data={bars} />
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Despesas por categoria</h2>
          <CategoryPie data={pieData} />
          <ul className="mt-2 space-y-1 text-sm">
            {pieData.slice(0, 5).map((c) => (
              <li key={c.name} className="flex justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
                <span className="font-medium">{formatBRL(c.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Últimos lançamentos</h2>
            <Link href="/app/transacoes" className="text-sm text-brand-700">Ver todos</Link>
          </div>
          {recent?.length ? (
            <ul className="divide-y divide-slate-100">
              {(recent as unknown as Transaction[]).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{t.categories?.icon ?? "🏷️"}</span>
                    <div>
                      <p className="font-medium">{t.description}</p>
                      <p className="text-xs text-slate-500">{formatDate(t.date)} · {t.categories?.name ?? "Sem categoria"}</p>
                    </div>
                  </div>
                  <span className={t.type === "income" ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                    {t.type === "income" ? "+" : "−"} {formatBRL(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Nenhum lançamento ainda.</EmptyState>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Orçamentos do mês</h2>
            <Link href={`/app/orcamentos?mes=${month}`} className="text-sm text-brand-700">Gerenciar</Link>
          </div>
          {budgets?.length ? (
            <ul className="space-y-4">
              {(budgets as unknown as Array<{ id: string; amount: number; category_id: string; categories: { name: string; icon: string; color: string } }>).map((b) => {
                const spent = spentByCategoryId.get(b.category_id) ?? 0;
                const pct = (spent / Number(b.amount)) * 100;
                return (
                  <li key={b.id} className="text-sm">
                    <div className="mb-1 flex justify-between">
                      <span>{b.categories.icon} {b.categories.name}</span>
                      <span className={pct > 100 ? "font-medium text-rose-600" : "text-slate-600"}>
                        {formatBRL(spent)} / {formatBRL(b.amount)}
                      </span>
                    </div>
                    <ProgressBar value={pct} color={pct > 100 ? "#e11d48" : pct > 80 ? "#f59e0b" : b.categories.color} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>Nenhum orçamento definido para este mês.</EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between text-sm text-slate-500">
        {label}
        {icon}
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone ?? ""}`}>{value}</p>
    </Card>
  );
}
