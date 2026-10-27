import { parseMoney } from "@/lib/format";

export type ParsedMessage =
  | { kind: "transaction"; type: "income" | "expense"; amount: number; description: string; daysAgo: number }
  | { kind: "command"; command: Command; arg?: string }
  | { kind: "unknown" };

export type Command = "help" | "balance" | "summary" | "statement" | "undo" | "link" | "categories" | "goals";

/** Remove acentos e deixa minúsculo. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const INCOME_VERBS = ["recebi", "ganhei", "entrou", "entrada", "receita", "caiu", "vendi", "recebimento"];
const EXPENSE_VERBS = ["gastei", "paguei", "comprei", "gasto", "despesa", "saiu", "torrei", "pagamento de", "pago"];

const COMMANDS: Array<[RegExp, Command]> = [
  [/^(ajuda|help|menu|oi|ola|bom dia|boa tarde|boa noite|comandos|\?)$/, "help"],
  [/^(saldo|saldos|quanto tenho)$/, "balance"],
  [/^(resumo|relatorio|balanco|como estou|mes)$/, "summary"],
  [/^(extrato|ultimos|ultimas|lancamentos|historico)$/, "statement"],
  [/^(desfazer|apagar|apagar ultimo|cancelar|excluir ultimo|desfaz)$/, "undo"],
  [/^(categorias|categoria)$/, "categories"],
  [/^(metas|meta|objetivos)$/, "goals"],
];

const FILLERS = new Set(["no", "na", "nos", "nas", "de", "do", "da", "dos", "das", "em", "com", "pra", "para", "pro", "o", "a", "um", "uma", "reais", "real", "r$", "e"]);

export function parseMessage(input: string): ParsedMessage {
  // `raw` e `text` têm o mesmo comprimento, então os índices do match valem para os dois.
  const raw = input.normalize("NFC").replace(/\s+/g, " ").trim().replace(/[!.]+$/g, "");
  const text = normalize(raw);
  if (!text) return { kind: "unknown" };

  const link = text.match(/^vincular\s+(\d{6})$/);
  if (link) return { kind: "command", command: "link", arg: link[1] };

  for (const [re, command] of COMMANDS) if (re.test(text)) return { kind: "command", command };

  // Valor: primeiro número da frase (aceita "R$ 1.234,56", "50", "12,90", "-30", "+100").
  const amountMatch = text.match(/([+-])?\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(reais|real|conto|contos|pila))?/);
  if (!amountMatch) return { kind: "unknown" };
  const amount = parseMoney(amountMatch[2]);
  if (!amount) return { kind: "unknown" };
  const sign = amountMatch[1];

  let type: "income" | "expense" = "expense";
  if (sign === "+" || INCOME_VERBS.some((v) => new RegExp(`(^|\\s)${v}(\\s|$)`).test(text))) type = "income";
  if (sign === "-" || EXPENSE_VERBS.some((v) => new RegExp(`(^|\\s)${v}(\\s|$)`).test(text))) {
    // Verbo de despesa tem prioridade só se não houver "+" explícito.
    if (sign !== "+") type = "expense";
  }

  let daysAgo = 0;
  if (/(^|\s)anteontem(\s|$)/.test(text)) daysAgo = 2;
  else if (/(^|\s)ontem(\s|$)/.test(text)) daysAgo = 1;

  const verbs = [...INCOME_VERBS, ...EXPENSE_VERBS].sort((a, b) => b.length - a.length);
  let rest = (raw.slice(0, amountMatch.index) + " " + raw.slice((amountMatch.index ?? 0) + amountMatch[0].length))
    .replace(/\s+/g, " ")
    .trim();
  // Remove verbos, "hoje/ontem/anteontem" e palavras de ligação nas pontas.
  for (const v of verbs) rest = rest.replace(new RegExp(`(^|\\s)${v}(?=\\s|$)`, "i"), " ");
  rest = rest.replace(/(^|\s)(hoje|ontem|anteontem)(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();
  const words = rest.split(" ").filter(Boolean);
  while (words.length && FILLERS.has(normalize(words[0]))) words.shift();
  while (words.length && FILLERS.has(normalize(words[words.length - 1]))) words.pop();
  const description = words.join(" ").replace(/^[,;:-]+|[,;:-]+$/g, "").trim();

  return {
    kind: "transaction",
    type,
    amount,
    description: description ? description.charAt(0).toUpperCase() + description.slice(1) : type === "income" ? "Receita" : "Despesa",
    daysAgo,
  };
}

export type CategoryLike = { id: string; name: string; type: "income" | "expense"; keywords: string[] | null };

/** Escolhe a categoria pelo nome ou por palavras-chave contidas na descrição. */
export function matchCategory<T extends CategoryLike>(description: string, type: "income" | "expense", categories: T[]): T | undefined {
  const desc = ` ${normalize(description)} `;
  const candidates = categories.filter((c) => c.type === type);
  for (const c of candidates) {
    const terms = [c.name, ...(c.keywords ?? [])].map(normalize).filter(Boolean);
    if (terms.some((t) => desc.includes(` ${t} `) || desc.includes(` ${t}s `))) return c;
  }
  return candidates.find((c) => ["outros", "outras receitas"].includes(normalize(c.name)));
}
