export type TxType = "income" | "expense";

export type Category = { id: string; name: string; type: TxType; icon: string; color: string; keywords: string[] };
export type Account = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  color: string;
  initial_balance: number;
  source: "manual" | "open_finance";
  is_archived: boolean;
  balance: number;
};
export type CreditCard = {
  id: string;
  name: string;
  brand: string | null;
  color: string;
  limit_amount: number;
  available_limit: number | null;
  closing_day: number;
  due_day: number;
  source: "manual" | "open_finance";
};
export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  date: string;
  paid: boolean;
  notes: string | null;
  source: "manual" | "whatsapp" | "open_finance";
  category_id: string | null;
  account_id: string | null;
  credit_card_id: string | null;
  categories: Pick<Category, "name" | "icon" | "color"> | null;
  accounts: { name: string } | null;
  credit_cards: { name: string } | null;
};

export const ACCOUNT_TYPES: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  wallet: "Carteira",
  investment: "Investimentos",
  other: "Outra",
};

export const SOURCE_LABEL: Record<Transaction["source"], string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  open_finance: "Open Finance",
};
