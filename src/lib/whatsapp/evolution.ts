import { requireEnv } from "@/lib/env";

/** Envia uma mensagem de texto pela Evolution API (v2). */
export async function sendWhatsAppText(number: string, text: string): Promise<void> {
  const baseUrl = requireEnv("EVOLUTION_API_URL").replace(/\/$/, "");
  const instance = requireEnv("EVOLUTION_INSTANCE");
  const res = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: requireEnv("EVOLUTION_API_KEY") },
    body: JSON.stringify({ number, text }),
  });
  if (!res.ok) {
    throw new Error(`Evolution API respondeu ${res.status}: ${await res.text()}`);
  }
}

type EvolutionMessage = {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string };
  videoMessage?: { caption?: string };
  // Mensagens temporárias, de visualização única ou editadas chegam "embrulhadas".
  ephemeralMessage?: { message?: EvolutionMessage };
  viewOnceMessage?: { message?: EvolutionMessage };
  viewOnceMessageV2?: { message?: EvolutionMessage };
  documentWithCaptionMessage?: { message?: EvolutionMessage };
  editedMessage?: { message?: EvolutionMessage };
};

type EvolutionMessageData = {
  key?: { remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean; id?: string };
  pushName?: string;
  messageType?: string;
  message?: EvolutionMessage;
};

export type EvolutionWebhook = {
  event?: string;
  instance?: string;
  data?: EvolutionMessageData | EvolutionMessageData[] | { messages?: EvolutionMessageData[] };
};

function messageText(message: EvolutionMessage | undefined, depth = 0): string {
  if (!message || depth > 3) return "";
  const direct =
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption;
  if (direct) return direct;
  const inner =
    message.ephemeralMessage?.message ??
    message.viewOnceMessage?.message ??
    message.viewOnceMessageV2?.message ??
    message.documentWithCaptionMessage?.message ??
    message.editedMessage?.message;
  return messageText(inner, depth + 1);
}

function firstMessage(data: EvolutionWebhook["data"]): EvolutionMessageData | undefined {
  if (!data) return undefined;
  if (Array.isArray(data)) return data[0];
  if ("messages" in data && Array.isArray(data.messages)) return data.messages[0];
  return data as EvolutionMessageData;
}

export type IncomingResult =
  | { ok: true; jid: string; text: string; name?: string }
  | { ok: false; reason: string };

/** Analisa um evento da Evolution e diz se é uma mensagem de texto recebida (ou por que foi ignorado). */
export function inspectIncoming(payload: EvolutionWebhook): IncomingResult {
  const event = (payload.event ?? "").toLowerCase().replace(/_/g, ".");
  if (event && event !== "messages.upsert") return { ok: false, reason: `evento ${payload.event}` };
  const data = firstMessage(payload.data);
  if (!data?.key?.remoteJid) return { ok: false, reason: "sem remetente (remoteJid)" };
  if (data.key.fromMe) return { ok: false, reason: "mensagem enviada pelo próprio número do assistente" };
  let jid = data.key.remoteJid;
  if (jid.endsWith("@g.us") || jid.endsWith("@broadcast")) return { ok: false, reason: "grupo ou lista de transmissão" };
  // Contas com LID: a Evolution envia o número real em remoteJidAlt (ou senderPn).
  if (jid.endsWith("@lid")) {
    const alt = data.key.remoteJidAlt ?? data.key.senderPn;
    if (!alt) return { ok: false, reason: "remetente em formato LID sem número real (remoteJidAlt)" };
    jid = alt;
  }
  const text = messageText(data.message).trim();
  if (!text) return { ok: false, reason: `mensagem sem texto (tipo ${data.messageType ?? "desconhecido"})` };
  return { ok: true, jid, text, name: data.pushName };
}

/** Extrai remetente e texto de um evento messages.upsert. Retorna null se não for texto recebido. */
export function extractIncomingText(payload: EvolutionWebhook): { jid: string; text: string; name?: string } | null {
  const result = inspectIncoming(payload);
  return result.ok ? { jid: result.jid, text: result.text, name: result.name } : null;
}
