import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonth } from "@/lib/format";

/** Navegação de mês via query string (?mes=YYYY-MM), preservando outros filtros. */
export function MonthPicker({ month, basePath, params = {} }: { month: string; basePath: string; params?: Record<string, string | undefined> }) {
  const href = (m: string) => {
    const q = new URLSearchParams(Object.entries({ ...params, mes: m }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${q}`;
  };
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
      <Link href={href(shiftMonth(month, -1))} className="rounded-md p-1.5 hover:bg-slate-100" aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="min-w-36 text-center text-sm font-medium">{monthLabel(month)}</span>
      <Link href={href(shiftMonth(month, 1))} className="rounded-md p-1.5 hover:bg-slate-100" aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function resolveMonth(value: string | undefined, today: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : today.slice(0, 7);
}
