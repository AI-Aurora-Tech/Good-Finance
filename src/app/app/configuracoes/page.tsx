import { requireUser } from "@/lib/supabase/server";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { updateProfile } from "../actions";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, plan").eq("id", user.id).single();

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <h2 className="mb-4 font-semibold">Perfil</h2>
          <form action={updateProfile} className="space-y-3">
            <Field label="Nome"><Input name="full_name" defaultValue={profile?.full_name ?? ""} /></Field>
            <Field label="E-mail"><Input value={user.email ?? ""} disabled readOnly /></Field>
            <Button type="submit">Salvar</Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Plano</h2>
          <p className="mt-2 text-sm text-slate-600">
            Você está no plano <b>{profile?.plan === "pro" ? "Pro" : "Grátis"}</b>.
          </p>
        </Card>
      </div>
    </>
  );
}
