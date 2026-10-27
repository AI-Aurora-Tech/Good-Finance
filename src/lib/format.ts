const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number | string | null | undefined): string {
  return brl.format(Number(value ?? 0));
}

/** "2026-10-27" -> "27/10/2026" sem problemas de fuso horário. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function todayISO(timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** Primeiro e último dia do mês de uma data YYYY-MM-DD ou YYYY-MM. */
export function monthRange(ref: string): { start: string; end: string; month: string } {
  const [y, m] = ref.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, "0")}`, month: `${y}-${mm}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Converte "1.234,56" / "1234.56" / "R$ 50" em número. */
export function parseMoney(input: string): number | null {
  let s = input.replace(/r\$\s*/i, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma !== -1) {
    s = s.replace(/,/g, "");
  } else if (lastDot !== -1 && lastComma === -1) {
    // "1.234" (milhar) vs "12.50" (decimal)
    const decimals = s.length - lastDot - 1;
    if (decimals === 3 && s.split(".").length >= 2) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
