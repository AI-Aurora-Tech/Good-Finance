import { Trash2 } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { formatBRL, formatDate, todayISO } from "@/lib/format";
import { Button, Card, EmptyState, Field, Input, PageHeader, ProgressBar } from "@/components/ui";
import { contributeGoal, deleteGoal, saveGoal } from "../actions";

export const metadata = { title: "Metas" };

type Goal = { id: string; name: string; target_amount: number; current_amount: number; deadline: string | null; color: string };

function monthsUntil(deadline: string, today: string) {
  const [y1, m1] = today.split("-").map(Number);
  const [y2, m2] = deadline.split("-").map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}

export default async function GoalsPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("goals").select("*").eq("user_id", user.id).order("created_at");
  const goals = (data ?? []) as Goal[];
  const today = todayISO();

  return (
    <>
      <PageHeader title="Metas" description="Acompanhe seus objetivos financeiros" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {goals.length ? (
            goals.map((g) => {
              const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));
              const pct = (Number(g.current_amount) / Number(g.target_amount)) * 100;
              return (
                <Card key={g.id}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">🎯 {g.name}</p>
                      {g.deadline && <p className="text-xs text-slate-500">até {formatDate(g.deadline)}</p>}
                    </div>
                    <form action={deleteGoal}>
                      <input type="hidden" name="id" value={g.id} />
                      <button className="rounded p-1.5 text-slate-400 hover:text-red-600" aria-label="Excluir meta"><Trash2 className="h-4 w-4" /></button>
                    </form>
                  </div>
                  <p className="mt-3 text-xl font-bold">{formatBRL(g.current_amount)}</p>
                  <p className="mb-2 text-xs text-slate-500">de {formatBRL(g.target_amount)} · {Math.min(100, Math.round(pct))}%</p>
                  <ProgressBar value={pct} color={g.color} />
                  {remaining > 0 && g.deadline && g.deadline > today && (
                    <p className="mt-2 text-xs text-slate-500">Guarde {formatBRL(remaining / monthsUntil(g.deadline, today))}/mês para chegar lá.</p>
                  )}
                  {remaining === 0 && <p className="mt-2 text-xs font-medium text-emerald-600">Meta alcançada! 🎉</p>}
                  <form action={contributeGoal} className="mt-4 flex gap-2">
                    <input type="hidden" name="id" value={g.id} />
                    <Input name="amount" inputMode="decimal" placeholder="Valor (use - para retirar)" required />
                    <Button type="submit" variant="secondary">Guardar</Button>
                  </form>
                </Card>
              );
            })
          ) : (
            <Card className="sm:col-span-2"><EmptyState>Crie sua primeira meta ao lado.</EmptyState></Card>
          )}
        </div>
        <Card className="h-fit">
          <h2 className="mb-4 font-semibold">Nova meta</h2>
          <form action={saveGoal} className="space-y-3">
            <Field label="Nome"><Input name="name" required placeholder="Reserva de emergência" /></Field>
            <Field label="Valor alvo (R$)"><Input name="target_amount" inputMode="decimal" required /></Field>
            <Field label="Já guardado (R$)"><Input name="current_amount" inputMode="decimal" defaultValue="0" /></Field>
            <Field label="Prazo"><Input name="deadline" type="date" /></Field>
            <Field label="Cor"><Input name="color" type="color" defaultValue="#f59e0b" className="h-10 p-1" /></Field>
            <Button type="submit" className="w-full">Criar meta</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
