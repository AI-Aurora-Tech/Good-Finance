import { describe, expect, it } from "vitest";
import { inspectIncoming } from "./evolution";

const key = { remoteJid: "5511999998888@s.whatsapp.net", fromMe: false };

describe("inspectIncoming", () => {
  it("lê texto simples", () => {
    const r = inspectIncoming({ event: "messages.upsert", data: { key, message: { conversation: "saldo" } } });
    expect(r).toMatchObject({ ok: true, jid: key.remoteJid, text: "saldo" });
  });

  it("aceita o nome do evento em maiúsculas", () => {
    const r = inspectIncoming({ event: "MESSAGES_UPSERT", data: { key, message: { conversation: "saldo" } } });
    expect(r.ok).toBe(true);
  });

  it("desembrulha mensagens temporárias", () => {
    const r = inspectIncoming({
      event: "messages.upsert",
      data: { key, message: { ephemeralMessage: { message: { extendedTextMessage: { text: "gastei 10 no café" } } } } },
    });
    expect(r).toMatchObject({ ok: true, text: "gastei 10 no café" });
  });

  it("aceita data como lista", () => {
    const r = inspectIncoming({ event: "messages.upsert", data: [{ key, message: { conversation: "resumo" } }] });
    expect(r).toMatchObject({ ok: true, text: "resumo" });
  });

  it("usa o número real em contas LID", () => {
    const r = inspectIncoming({
      event: "messages.upsert",
      data: { key: { remoteJid: "123@lid", senderPn: key.remoteJid }, message: { conversation: "oi" } },
    });
    expect(r).toMatchObject({ ok: true, jid: key.remoteJid });
  });

  it("explica por que ignorou", () => {
    expect(inspectIncoming({ event: "connection.update" })).toEqual({ ok: false, reason: "evento connection.update" });
    expect(inspectIncoming({ event: "messages.upsert", data: { key: { ...key, fromMe: true }, message: { conversation: "x" } } })).toMatchObject({ ok: false });
    expect(inspectIncoming({ event: "messages.upsert", data: { key: { remoteJid: "1@g.us" }, message: { conversation: "x" } } })).toMatchObject({ ok: false });
    expect(inspectIncoming({ event: "messages.upsert", data: { key, messageType: "audioMessage", message: {} } })).toEqual({
      ok: false,
      reason: "mensagem sem texto (tipo audioMessage)",
    });
  });
});
