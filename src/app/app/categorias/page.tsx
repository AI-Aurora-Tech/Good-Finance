import { Trash2 } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import type { Category } from "@/lib/types";
import { deleteCategory, saveCategory } from "../actions";

export const metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("categories").select("*").eq("user_id", user.id).order("name");
  const cats = (data ?? []) as Category[];

  const list = (type: "expense" | "income", title: string) => (
    <Card>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="divide-y divide-slate-100">
        {cats.filter((c) => c.type === type).map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="grid h-9 w-9 place-items-center rounded-lg text-lg" style={{ backgroundColor: `${c.color}22` }}>{c.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.name}</p>
              {!!c.keywords?.length && <p className="truncate text-xs text-slate-500">WhatsApp: {c.keywords.join(", ")}</p>}
            </div>
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={c.id} />
              <button className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Excluir ${c.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </form>
          </li>
        ))}
      </ul>
    </Card>
  );

  return (
    <>
      <PageHeader title="Categorias" description="As palavras-chave ajudam o assistente do WhatsApp a categorizar seus lançamentos." />
      <div className="grid gap-6 lg:grid-cols-3">
        {list("expense", "Despesas")}
        {list("income", "Receitas")}
        <Card className="h-fit">
          <h2 className="mb-4 font-semibold">Nova categoria</h2>
          <form action={saveCategory} className="space-y-3">
            <Field label="Nome"><Input name="name" required maxLength={60} /></Field>
            <Field label="Tipo">
              <Select name="type"><option value="expense">Despesa</option><option value="income">Receita</option></Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ícone (emoji)"><Input name="icon" defaultValue="🏷️" maxLength={8} /></Field>
              <Field label="Cor"><Input name="color" type="color" defaultValue="#64748b" className="h-10 p-1" /></Field>
            </div>
            <Field label="Palavras-chave (separadas por vírgula)"><Input name="keywords" placeholder="pet, ração, veterinário" /></Field>
            <Button type="submit" className="w-full">Adicionar</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
