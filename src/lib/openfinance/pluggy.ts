import { requireEnv } from "@/lib/env";

/**
 * Cliente mínimo da API REST da Pluggy (agregador Open Finance regulado pelo Banco Central).
 * Docs: https://docs.pluggy.ai
 */
const BASE_URL = process.env.PLUGGY_API_URL ?? "https://api.pluggy.ai";

let cachedKey: { value: string; expiresAt: number } | null = null;

async function apiKey(): Promise<string> {
  if (cachedKey && cachedKey.expiresAt > Date.now()) return cachedKey.value;
  const res = await fetch(`${BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: requireEnv("PLUGGY_CLIENT_ID"), clientSecret: requireEnv("PLUGGY_CLIENT_SECRET") }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pluggy /auth falhou (${res.status})`);
  const { apiKey: value } = (await res.json()) as { apiKey: string };
  // A chave vale 2h; renovamos com folga.
  cachedKey = { value, expiresAt: Date.now() + 90 * 60 * 1000 };
  return value;
}

async function pluggy<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-API-KEY": await apiKey(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pluggy ${init.method ?? "GET"} ${path} falhou (${res.status}): ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export type PluggyItem = {
  id: string;
  status: string;
  executionStatus?: string;
  clientUserId?: string | null;
  connector: { id: number; name: string; imageUrl?: string };
  error?: { message?: string } | null;
};

export type PluggyAccount = {
  id: string;
  type: "BANK" | "CREDIT";
  subtype: string;
  name: string;
  marketingName?: string | null;
  number?: string;
  balance: number;
  creditData?: { creditLimit?: number | null; availableCreditLimit?: number | null; brand?: string | null; balanceCloseDate?: string | null; balanceDueDate?: string | null } | null;
};

export type PluggyTransaction = {
  id: string;
  description: string;
  descriptionRaw?: string | null;
  amount: number;
  date: string;
  type: "DEBIT" | "CREDIT";
  category?: string | null;
  status?: "PENDING" | "POSTED";
};

export function createConnectToken(options: { itemId?: string; clientUserId: string; webhookUrl?: string }) {
  return pluggy<{ accessToken: string }>("/connect_token", {
    method: "POST",
    body: JSON.stringify({
      itemId: options.itemId,
      options: { clientUserId: options.clientUserId, webhookUrl: options.webhookUrl },
    }),
  });
}

export const getItem = (id: string) => pluggy<PluggyItem>(`/items/${encodeURIComponent(id)}`);
export const deleteItem = (id: string) => pluggy<void>(`/items/${encodeURIComponent(id)}`, { method: "DELETE" });
/** Solicita uma nova coleta de dados ao banco (o resultado chega por webhook). */
export const refreshItem = (id: string) => pluggy<PluggyItem>(`/items/${encodeURIComponent(id)}`, { method: "PATCH", body: "{}" });

export async function listAccounts(itemId: string): Promise<PluggyAccount[]> {
  const res = await pluggy<{ results: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  return res.results;
}

export async function listTransactions(accountId: string, from: string): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await pluggy<{ results: PluggyTransaction[]; totalPages: number }>(
      `/transactions?accountId=${encodeURIComponent(accountId)}&from=${from}&pageSize=500&page=${page}`,
    );
    all.push(...res.results);
    if (page >= res.totalPages) break;
  }
  return all;
}
