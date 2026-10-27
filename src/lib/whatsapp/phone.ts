/** Extrai só os dígitos de um JID do WhatsApp ("5511999998888@s.whatsapp.net"). */
export function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "");
}

/** Normaliza para o formato com DDI 55 (somente dígitos). */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

/**
 * Celulares brasileiros podem chegar com ou sem o nono dígito no WhatsApp.
 * Retorna as duas variantes para a busca no banco.
 */
export function phoneVariants(phone: string): string[] {
  const p = normalizePhone(phone);
  const variants = new Set([p]);
  if (p.startsWith("55")) {
    const ddd = p.slice(2, 4);
    const number = p.slice(4);
    if (number.length === 9 && number.startsWith("9")) variants.add(`55${ddd}${number.slice(1)}`);
    if (number.length === 8) variants.add(`55${ddd}9${number}`);
  }
  return [...variants];
}
