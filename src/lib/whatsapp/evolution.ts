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

export type EvolutionWebhook = {
  event?: string;
  instance?: string;
  data?: {
    key?: { remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    messageType?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { caption?: string };
    };
  };
};

/** Extrai remetente e texto de um evento messages.upsert. Retorna null se não for texto recebido. */
export function extractIncomingText(payload: EvolutionWebhook): { jid: string; text: string; name?: string } | null {
  const event = (payload.event ?? "").toLowerCase().replace("_", ".");
  if (event && event !== "messages.upsert") return null;
  const data = payload.data;
  if (!data?.key?.remoteJid || data.key.fromMe) return null;
  // Ignora grupos e listas de transmissão.
  let jid = data.key.remoteJid;
  if (jid.endsWith("@g.us") || jid.endsWith("@broadcast")) return null;
  // Contas com LID: a Evolution envia o número real em remoteJidAlt.
  if (jid.endsWith("@lid") && data.key.remoteJidAlt) jid = data.key.remoteJidAlt;
  const text =
    data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? data.message?.imageMessage?.caption ?? "";
  if (!text.trim()) return null;
  return { jid, text: text.trim(), name: data.pushName };
}
