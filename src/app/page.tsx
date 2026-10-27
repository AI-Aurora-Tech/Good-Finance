import { ButtonLink, Logo } from "@/components/ui";
import { BarChart3, CreditCard, Landmark, MessageCircle, PiggyBank, ShieldCheck, Target } from "lucide-react";

const features = [
  { icon: MessageCircle, title: "Assistente no WhatsApp", text: "Mande “gastei 50 no mercado” e pronto: o lançamento já está categorizado no seu painel." },
  { icon: Landmark, title: "Open Finance", text: "Conecte seus bancos com segurança e importe saldos, cartões e transações automaticamente." },
  { icon: BarChart3, title: "Painel completo", text: "Receitas, despesas, saldo e gastos por categoria em gráficos claros, mês a mês." },
  { icon: CreditCard, title: "Cartões de crédito", text: "Acompanhe limite, fechamento, vencimento e gastos de cada cartão." },
  { icon: PiggyBank, title: "Orçamentos", text: "Defina limites por categoria e receba o alerta antes de estourar o mês." },
  { icon: Target, title: "Metas", text: "Reserve de emergência, viagem, carro novo: acompanhe o progresso de cada objetivo." },
];

const plans = [
  {
    name: "Grátis",
    price: "R$ 0",
    items: ["Lançamentos ilimitados no app", "Assistente no WhatsApp", "Categorias, orçamentos e metas", "1 conexão Open Finance"],
  },
  {
    name: "Pro",
    price: "R$ 19,90/mês",
    highlight: true,
    items: ["Tudo do plano Grátis", "Conexões Open Finance ilimitadas", "Sincronização diária automática", "Suporte prioritário"],
  },
];

export default function Home() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost">Entrar</ButtonLink>
          <ButtonLink href="/cadastro">Criar conta grátis</ButtonLink>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Finanças pessoais sem planilha</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            Seu dinheiro organizado <span className="text-brand-600">direto pelo WhatsApp</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Registre gastos em segundos por mensagem, conecte seus bancos via Open Finance e veja para onde vai cada real.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/cadastro" className="px-6 py-3 text-base">Começar agora</ButtonLink>
            <ButtonLink href="#recursos" variant="secondary" className="px-6 py-3 text-base">Ver recursos</ButtonLink>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm rounded-3xl bg-[#e5ddd5] p-4 shadow-xl ring-1 ring-slate-200">
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-brand-700 px-3 py-2 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.svg" alt="" width={24} height={24} className="h-6 w-6 rounded-md bg-white p-0.5" /> <span className="font-semibold">Good Finance</span>
          </div>
          <div className="space-y-2 text-sm">
            <p className="ml-auto w-fit rounded-lg bg-[#dcf8c6] px-3 py-2 shadow-sm">gastei 42,90 no ifood</p>
            <p className="w-fit max-w-[85%] rounded-lg bg-white px-3 py-2 shadow-sm">
              💸 <b>Despesa registrada!</b><br />Ifood — <b>R$ 42,90</b><br />🍽️ Alimentação · 🏦 Carteira
            </p>
            <p className="ml-auto w-fit rounded-lg bg-[#dcf8c6] px-3 py-2 shadow-sm">resumo</p>
            <p className="w-fit max-w-[85%] rounded-lg bg-white px-3 py-2 shadow-sm">
              📊 <b>Resumo do mês</b><br />💰 Receitas: R$ 5.200,00<br />💸 Despesas: R$ 3.148,35<br />✅ Resultado: <b>R$ 2.051,65</b>
            </p>
          </div>
        </div>
      </section>

      <section id="recursos" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Tudo o que você precisa para controlar suas finanças</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <f.icon className="h-8 w-8 text-brand-600" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">Planos</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {plans.map((p) => (
            <div key={p.name} className={`rounded-2xl p-8 ring-1 ${p.highlight ? "bg-brand-900 text-white ring-brand-900" : "bg-white ring-slate-200"}`}>
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-2 text-3xl font-extrabold">{p.price}</p>
              <ul className="mt-6 space-y-2 text-sm">
                {p.items.map((i) => (
                  <li key={i}>✓ {i}</li>
                ))}
              </ul>
              <ButtonLink href="/cadastro" variant={p.highlight ? "secondary" : "primary"} className="mt-8 w-full">
                Começar
              </ButtonLink>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-slate-500">
          <Logo className="text-base text-slate-700" />
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" /> Dados protegidos e conexão bancária via Open Finance Brasil
          </span>
          <span>© {new Date().getFullYear()} Good Finance</span>
        </div>
      </footer>
    </div>
  );
}
