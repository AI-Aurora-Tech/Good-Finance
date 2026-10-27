import { describe, expect, it } from "vitest";
import { mapPluggyTransaction, resolveCategoryId } from "./mapping";

const base = { id: "t1", description: "PADARIA X", amount: -12.5, date: "2026-10-20T00:00:00.000Z", type: "DEBIT" as const };

describe("mapPluggyTransaction", () => {
  it("débito em conta vira despesa com valor positivo", () => {
    expect(mapPluggyTransaction(base, "BANK")).toMatchObject({ type: "expense", amount: 12.5, date: "2026-10-20", external_id: "pluggy:t1" });
  });
  it("crédito em conta vira receita", () => {
    expect(mapPluggyTransaction({ ...base, amount: 3000, type: "CREDIT", category: "Salary" }, "BANK")).toMatchObject({
      type: "income",
      amount: 3000,
      categoryName: "Salário",
    });
  });
  it("ignora pagamento de fatura no cartão", () => {
    expect(mapPluggyTransaction({ ...base, amount: -500, type: "CREDIT" }, "CREDIT")).toBeNull();
  });
  it("compra no cartão vira despesa", () => {
    expect(mapPluggyTransaction({ ...base, amount: 80, category: "Groceries" }, "CREDIT")).toMatchObject({ type: "expense", amount: 80, categoryName: "Mercado" });
  });
});

describe("resolveCategoryId", () => {
  const cats = [
    { id: "m", name: "Mercado", type: "expense" as const, keywords: [] },
    { id: "a", name: "Alimentação", type: "expense" as const, keywords: ["padaria"] },
  ];
  it("prioriza categoria da Pluggy", () => {
    expect(resolveCategoryId({ type: "expense", amount: 1, description: "padaria", date: "", external_id: "", categoryName: "Mercado" }, cats)).toBe("m");
  });
  it("usa palavras-chave quando não há categoria", () => {
    expect(resolveCategoryId({ type: "expense", amount: 1, description: "PADARIA X", date: "", external_id: "" }, cats)).toBe("a");
  });
});
