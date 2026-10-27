import { describe, expect, it } from "vitest";
import { matchCategory, parseMessage } from "./parser";
import { jidToPhone, phoneVariants } from "./phone";
import { parseMoney } from "@/lib/format";

describe("parseMessage", () => {
  it.each([
    ["gastei 50 no mercado", "expense", 50, "Mercado", 0],
    ["Gastei R$ 32,90 com uber ontem", "expense", 32.9, "Uber", 1],
    ["recebi 2.500 de salário", "income", 2500, "Salário", 0],
    ["ganhei 300 reais de freela", "income", 300, "Freela", 0],
    ["45 almoço", "expense", 45, "Almoço", 0],
    ["ifood 27,50", "expense", 27.5, "Ifood", 0],
    ["+150 venda bolo", "income", 150, "Venda bolo", 0],
    ["-30 lanche", "expense", 30, "Lanche", 0],
    ["paguei 1.234,56 de aluguel", "expense", 1234.56, "Aluguel", 0],
    ["gastei 12.50 de café anteontem", "expense", 12.5, "Café", 2],
  ])("%s", (msg, type, amount, description, daysAgo) => {
    expect(parseMessage(msg)).toEqual({ kind: "transaction", type, amount, description, daysAgo });
  });

  it("reconhece comandos", () => {
    expect(parseMessage("Saldo")).toEqual({ kind: "command", command: "balance" });
    expect(parseMessage("resumo")).toEqual({ kind: "command", command: "summary" });
    expect(parseMessage("Ajuda")).toEqual({ kind: "command", command: "help" });
    expect(parseMessage("desfazer")).toEqual({ kind: "command", command: "undo" });
    expect(parseMessage("vincular 123456")).toEqual({ kind: "command", command: "link", arg: "123456" });
  });

  it("mensagem sem valor é desconhecida", () => {
    expect(parseMessage("tudo bem?")).toEqual({ kind: "unknown" });
  });
});

describe("matchCategory", () => {
  const cats = [
    { id: "1", name: "Mercado", type: "expense" as const, keywords: ["supermercado"] },
    { id: "2", name: "Transporte", type: "expense" as const, keywords: ["uber", "gasolina"] },
    { id: "3", name: "Outros", type: "expense" as const, keywords: [] },
    { id: "4", name: "Salário", type: "income" as const, keywords: ["salario"] },
  ];
  it("usa palavras-chave", () => expect(matchCategory("Uber pra casa", "expense", cats)?.id).toBe("2"));
  it("usa o nome", () => expect(matchCategory("mercado", "expense", cats)?.id).toBe("1"));
  it("ignora acentos", () => expect(matchCategory("Salário", "income", cats)?.id).toBe("4"));
  it("cai em Outros", () => expect(matchCategory("presente", "expense", cats)?.id).toBe("3"));
});

describe("telefone", () => {
  it("extrai do JID", () => expect(jidToPhone("5511999998888@s.whatsapp.net")).toBe("5511999998888"));
  it("gera variantes com/sem nono dígito", () => {
    expect(phoneVariants("5511999998888")).toEqual(["5511999998888", "551199998888"]);
    expect(phoneVariants("551199998888")).toEqual(["551199998888", "5511999998888"]);
    expect(phoneVariants("(11) 99999-8888")).toContain("5511999998888");
  });
});

describe("parseMoney", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1234.56", 1234.56],
    ["1.234", 1234],
    ["12,5", 12.5],
    ["R$ 50", 50],
    ["abc", null],
  ])("%s", (input, expected) => expect(parseMoney(input)).toBe(expected));
});
