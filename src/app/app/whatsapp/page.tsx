import { CheckCircle2, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { Button, ButtonLink, Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { generateWhatsAppCode, unlinkWhatsApp } from "../actions";

export const metadata = { title: "WhatsApp" };

const examples = ["gastei 50 no mercado", "uber 23,90 ontem", "recebi 3000 de salário", "saldo", "resumo", "extrato", "desfazer"];

function maskPhone(p: string) {
  const d = p.replace(/^55/, "");
  return `+55 (${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`;
}

export default async function WhatsAppPage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, whatsapp_link_code, whatsapp_link_code_expires_at, whatsapp_linked_at")
    .eq("id", user.id)
    .single();
  const { data: messages } = await supabase.from("whatsapp_messages").select("id, direction, body, created_at").order("created_at", { ascending: false }).limit(10);

  const botNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const codeValid = profile?.whatsapp_link_code && profile.whatsapp_link_code_expires_at && new Date(profile.whatsapp_link_code_expires_at) > new Date();
  const waLink = (text: string) => (botNumber ? `https://wa.me/${botNumber}?text=${encodeURIComponent(text)}` : undefined);

  return (
    <>
      <PageHeader title="WhatsApp" description="Registre gastos e consulte suas finanças conversando com o assistente." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          {profile?.phone ? (
            <>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="font-semibold">WhatsApp conectado</p>
                  <p className="text-sm text-slate-500">
                    {maskPhone(profile.phone)}{profile.whatsapp_linked_at ? ` · desde ${formatDate(profile.whatsapp_linked_at)}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {botNumber && (
                  <ButtonLink href={waLink("ajuda")!} target="_blank"><MessageCircle className="h-4 w-4" /> Abrir conversa</ButtonLink>
                )}
                <form action={unlinkWhatsApp}><Button variant="danger">Desconectar</Button></form>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-semibold">Conecte seu número em 2 passos</h2>
              <ol className="mt-4 space-y-4 text-sm">
                <li>
                  <b>1.</b> Gere um código de vinculação (válido por 15 minutos).
                  <form action={generateWhatsAppCode} className="mt-2"><Button variant="secondary">Gerar código</Button></form>
                </li>
                {codeValid && (
                  <li>
                    <b>2.</b> Envie esta mensagem para o assistente{botNumber ? ` (+${botNumber})` : ""}:
                    <p className="mt-2 rounded-lg bg-slate-100 px-4 py-3 font-mono text-lg tracking-wider">vincular {profile.whatsapp_link_code}</p>
                    {botNumber && (
                      <ButtonLink href={waLink(`vincular ${profile.whatsapp_link_code}`)!} target="_blank" className="mt-3">
                        <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
                      </ButtonLink>
                    )}
                    <p className="mt-2 text-xs text-slate-500">Depois de enviar, atualize esta página.</p>
                  </li>
                )}
              </ol>
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">O que você pode mandar</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {examples.map((e) => <li key={e} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800">{e}</li>)}
          </ul>
          <p className="mt-4 text-sm text-slate-600">
            O assistente identifica valor, tipo (receita ou despesa), data (&quot;ontem&quot;, &quot;anteontem&quot;) e escolhe a categoria pelas
            palavras-chave cadastradas em <b>Categorias</b>. Cite o nome do cartão ou da conta para lançar nele.
          </p>
        </Card>

        {!!messages?.length && (
          <Card className="lg:col-span-2">
            <h2 className="mb-3 font-semibold">Mensagens recentes</h2>
            <ul className="space-y-2 text-sm">
              {messages.reverse().map((m) => (
                <li key={m.id} className={`max-w-[80%] whitespace-pre-line rounded-lg px-3 py-2 ${m.direction === "in" ? "ml-auto bg-[#dcf8c6]" : "bg-slate-100"}`}>
                  {m.body}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
