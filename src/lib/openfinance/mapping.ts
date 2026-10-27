import { matchCategory, type CategoryLike } from "@/lib/whatsapp/parser";
import type { PluggyTransaction } from "./pluggy";

/** Categorias da Pluggy (em inglês) -> nomes das categorias padrão do Good Finance. */
const PLUGGY_CATEGORY_MAP: Array<[RegExp, string]> = [
  [/groceries|supermarket/i, "Mercado"],
  [/food|restaurant|eating|delivery/i, "Alimentação"],
  [/transport|taxi|ride|fuel|gas station|parking|toll|vehicle/i, "Transporte"],
  [/housing|rent|utilities|electricity|water|internet|telecom/i, "Moradia"],
  [/health|pharmacy|hospital|dentist|gym|fitness/i, "Saúde"],
  [/education|school|university|course|book/i, "Educação"],
  [/leisure|entertainment|travel|tickets|games|cinema|streaming/i, "Lazer"],
  [/shopping|clothing|electronics|online shopping/i, "Compras"],
  [/subscription|digital services/i, "Assinaturas"],
  [/salary|payroll|wage/i, "Salário"],
  [/investment|interest|dividend|income/i, "Investimentos"],
];

export type MappedTransaction = {
  type: "income" | "expense";
  amount: number;
  description: string;
  date: string;
  categoryName?: string;
  external_id: string;
};

/**
 * Converte uma transação da Pluggy no formato do Good Finance.
 * Em cartões de crédito, lançamentos de CRÉDITO são pagamentos da fatura/estornos
 * e são ignorados para não contar como receita.
 */
export function mapPluggyTransaction(tx: PluggyTransaction, accountType: "BANK" | "CREDIT"): MappedTransaction | null {
  if (!tx.amount) return null;
  if (accountType === "CREDIT" && tx.type === "CREDIT") return null;
  const type = tx.type === "CREDIT" ? "income" : "expense";
  const categoryName = tx.category ? PLUGGY_CATEGORY_MAP.find(([re]) => re.test(tx.category!))?.[1] : undefined;
  return {
    type,
    amount: Math.round(Math.abs(tx.amount) * 100) / 100,
    description: (tx.description || tx.descriptionRaw || "Transação").trim().slice(0, 200),
    date: tx.date.slice(0, 10),
    categoryName,
    external_id: `pluggy:${tx.id}`,
  };
}

export function resolveCategoryId<T extends CategoryLike>(mapped: MappedTransaction, categories: T[]): string | null {
  const byName = mapped.categoryName
    ? categories.find((c) => c.type === mapped.type && c.name === mapped.categoryName)
    : undefined;
  return (byName ?? matchCategory(mapped.description, mapped.type, categories))?.id ?? null;
}
