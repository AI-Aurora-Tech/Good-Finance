import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { formatBRL, formatDate, monthRange, todayISO } from "@/lib/format";
import { Button, ButtonLink, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { SOURCE_LABEL, type Category, type Transaction } from "@/lib/types";
import { deleteTransaction, saveTransaction } from "../actions";
import { MonthPicker, resolveMonth } from "../month-picker";

export const metadata = { title: "Lançamentos" };

type Search = { mes?: string; tipo?: string; categoria?: string; busca?: string; novo?: string; editar?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase, user } = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const month = resolveMonth(sp.mes, today);
  const { start, end } = monthRange(month);

  let query = supabase
    .from("transactions")
    .select("*, categories(name, icon, color), accounts(name), credit_cards(name)")
    .eq("user_id", user.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (sp.tipo === "income" || sp.tipo === "expense") query = query.eq("type", sp.tipo);
  if (sp.categoria && /^[0-9a-f-]{36}$/.test(sp.categoria)) query = query.eq("category_id", sp.categoria);
  if (sp.busca) query = query.ilike("description", `%${sp.busca.replace(/[%_]/g, "")}%`);

  const [{ data: txs }, { data: categories }, { data: accounts }, { data: cards }, editing] = await Promise.all([
    query,
    supabase.from("categories").select("*").eq("user_id", user.id).order("name"),
    supabase.from("accounts").select("id, name").eq("user_id", user.id).eq("is_archived", false).order("created_at"),
    supabase.from("credit_cards").select("id, name").eq("user_id", user.id).eq("is_archived", false).order("created_at"),
    sp.editar
      ? supabase.from("transactions").select("*").eq("id", sp.editar).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const list = (txs ?? []) as unknown as Transaction[];
  const cats = (categories ?? []) as Category[];
  const income = list.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const edit = editing.data as Transaction | null;
  const filters = { tipo: sp.tipo, categoria: sp.categoria, busca: sp.busca };

  const destination = edit
    ? edit.credit_card_id
      ? `card:${edit.credit_card_id}`
      : edit.account_id
        ? `account:${edit.account_id}`
        : ""
    : accounts?.[0]
      ? `account:${accounts[0].id}`
      : "";

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description="Receitas e despesas do mês"
        actions={<MonthPicker month={month} basePath="/app/transacoes" params={filters} />}
      />

      <details open={Boolean(sp.novo || edit)} className="mb-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <summary className="cursor-pointer select-none px-5 py-4 font-semibold">{edit ? "Editar lançamento" : "+ Novo lançamento"}</summary>
        <form action={saveTransaction} className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          {edit && <input type="hidden" name="id" value={edit.id} />}
          <Field label="Tipo">
            <Select name="type" defaultValue={edit?.type ?? "expense"}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </Select>
          </Field>
          <Field label="Valor (R$)">
            <Input name="amount" inputMode="decimal" placeholder="0,00" required defaultValue={edit ? String(edit.amount).replace(".", ",") : ""} />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Input name="description" required maxLength={200} defaultValue={edit?.description ?? ""} />
          </Field>
          <Field label="Data">
            <Input name="date" type="date" required defaultValue={edit?.date ?? (month === today.slice(0, 7) ? today : start)} />
          </Field>
          <Field label="Categoria">
            <Select name="category_id" defaultValue={edit?.category_id ?? ""}>
              <option value="">Sem categoria</option>
              <optgroup label="Despesas">
                {cats.filter((c) => c.type === "expense").map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </optgroup>
              <optgroup label="Receitas">
                {cats.filter((c) => c.type === "income").map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </optgroup>
            </Select>
          </Field>
          <Field label="Conta ou cartão">
            <Select name="destination" defaultValue={destination}>
              <option value="">Nenhum</option>
              <optgroup label="Contas">
                {accounts?.map((a) => <option key={a.id} value={`account:${a.id}`}>{a.name}</option>)}
              </optgroup>
              {!!cards?.length && (
                <optgroup label="Cartões">
                  {cards.map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.name}</option>)}
                </optgroup>
              )}
            </Select>
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="paid" defaultChecked={edit?.paid ?? true} className="h-4 w-4 accent-brand-600" />
            Pago / recebido
          </label>
          <Field label="Observações" className="sm:col-span-2 lg:col-span-4">
            <Input name="notes" maxLength={1000} defaultValue={edit?.notes ?? ""} />
          </Field>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit">{edit ? "Salvar alterações" : "Adicionar"}</Button>
            {edit && <ButtonLink href={`/app/transacoes?mes=${month}`} variant="secondary">Cancelar</ButtonLink>}
          </div>
        </form>
      </details>

      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="mes" value={month} />
        <Input name="busca" placeholder="Buscar descrição…" defaultValue={sp.busca ?? ""} className="max-w-xs" />
        <Select name="tipo" defaultValue={sp.tipo ?? ""} className="w-auto">
          <option value="">Todos os tipos</option>
          <option value="expense">Despesas</option>
          <option value="income">Receitas</option>
        </Select>
        <Select name="categoria" defaultValue={sp.categoria ?? ""} className="w-auto">
          <option value="">Todas as categorias</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </Select>
        <Button type="submit" variant="secondary">Filtrar</Button>
      </form>

      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <Card className="p-4"><p className="text-slate-500">Receitas</p><p className="text-lg font-bold text-emerald-600">{formatBRL(income)}</p></Card>
        <Card className="p-4"><p className="text-slate-500">Despesas</p><p className="text-lg font-bold text-rose-600">{formatBRL(expense)}</p></Card>
        <Card className="p-4"><p className="text-slate-500">Resultado</p><p className="text-lg font-bold">{formatBRL(income - expense)}</p></Card>
      </div>

      <Card className="p-0">
        {list.length ? (
          <ul className="divide-y divide-slate-100">
            {list.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="text-xl">{t.categories?.icon ?? "🏷️"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.description}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(t.date)} · {t.categories?.name ?? "Sem categoria"}
                    {t.credit_cards ? ` · 💳 ${t.credit_cards.name}` : t.accounts ? ` · ${t.accounts.name}` : ""}
                    {" · "}{SOURCE_LABEL[t.source]}
                    {!t.paid && " · pendente"}
                  </p>
                </div>
                <span className={t.type === "income" ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                  {t.type === "income" ? "+" : "−"} {formatBRL(t.amount)}
                </span>
                <div className="flex gap-1">
                  <Link href={`/app/transacoes?mes=${month}&editar=${t.id}`} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <form action={deleteTransaction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Nenhum lançamento encontrado neste mês.</EmptyState>
        )}
      </Card>
    </>
  );
}
