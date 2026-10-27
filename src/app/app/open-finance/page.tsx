import { RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { removeConnection, syncConnection } from "../actions";
import { ConnectBankButton } from "./connect-button";

export const metadata = { title: "Open Finance" };

const STATUS: Record<string, { label: string; tone: string }> = {
  UPDATED: { label: "Atualizado", tone: "bg-emerald-50 text-emerald-700" },
  UPDATING: { label: "Atualizando…", tone: "bg-sky-50 text-sky-700" },
  LOGIN_ERROR: { label: "Reconectar", tone: "bg-red-50 text-red-700" },
  OUTDATED: { label: "Desatualizado", tone: "bg-amber-50 text-amber-700" },
  WAITING_USER_INPUT: { label: "Ação necessária", tone: "bg-amber-50 text-amber-700" },
};

export default async function OpenFinancePage() {
  const { supabase } = await requireUser();
  const { data: connections } = await supabase.from("bank_connections").select("*").order("created_at");
  const configured = Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);

  return (
    <>
      <PageHeader
        title="Open Finance"
        description="Conecte seus bancos para importar contas, cartões e transações automaticamente."
        actions={configured ? <ConnectBankButton /> : undefined}
      />

      {!configured && (
        <Card className="mb-6 bg-amber-50 text-sm text-amber-900 ring-amber-200">
          Integração não configurada. Defina <code>PLUGGY_CLIENT_ID</code> e <code>PLUGGY_CLIENT_SECRET</code> nas variáveis de ambiente.
        </Card>
      )}

      <Card className="mb-6 flex items-start gap-3 text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <p>
          A conexão é feita pelo ambiente oficial do <b>Open Finance Brasil</b> através da Pluggy, instituição autorizada pelo Banco Central.
          O Good Finance tem acesso apenas de leitura: não movimenta dinheiro e não vê sua senha do banco. Você pode revogar o acesso a qualquer momento.
        </p>
      </Card>

      {connections?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {connections.map((c) => {
            const status = STATUS[c.status ?? ""] ?? { label: c.status ?? "—", tone: "bg-slate-100 text-slate-600" };
            return (
              <Card key={c.id}>
                <div className="flex items-center gap-3">
                  {c.institution_logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.institution_logo} alt="" className="h-10 w-10 rounded-lg object-contain" />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100">🏦</span>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{c.institution_name ?? "Banco"}</p>
                    <p className="text-xs text-slate-500">
                      {c.last_synced_at ? `Sincronizado em ${new Date(c.last_synced_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Ainda não sincronizado"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
                </div>
                {c.error_message && <p className="mt-3 text-sm text-red-600">{c.error_message}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={syncConnection}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button variant="secondary"><RefreshCw className="h-4 w-4" /> Sincronizar</Button>
                  </form>
                  {configured && ["LOGIN_ERROR", "OUTDATED", "WAITING_USER_INPUT"].includes(c.status ?? "") && (
                    <ConnectBankButton itemId={c.item_id} label="Reconectar" variant="secondary" />
                  )}
                  <form action={removeConnection}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button variant="danger"><Trash2 className="h-4 w-4" /> Desconectar</Button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState>Nenhum banco conectado ainda.</EmptyState></Card>
      )}
    </>
  );
}
