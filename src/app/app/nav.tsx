"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, Landmark, LayoutDashboard, Menu, MessageCircle, PiggyBank, Settings, Tags, Target, Wallet, X } from "lucide-react";
import { cn, Logo } from "@/components/ui";

const items = [
  { href: "/app", label: "Painel", icon: LayoutDashboard },
  { href: "/app/transacoes", label: "Lançamentos", icon: ArrowLeftRight },
  { href: "/app/contas", label: "Contas e cartões", icon: Wallet },
  { href: "/app/categorias", label: "Categorias", icon: Tags },
  { href: "/app/orcamentos", label: "Orçamentos", icon: PiggyBank },
  { href: "/app/metas", label: "Metas", icon: Target },
  { href: "/app/open-finance", label: "Open Finance", icon: Landmark },
  { href: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings },
];

export function Nav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-auto border-t border-slate-200 pt-4 text-sm">
      <p className="truncate px-3 text-slate-500">{userName}</p>
      <form action="/auth/signout" method="post">
        <button className="mt-2 w-full rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-100">Sair</button>
      </form>
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Logo />
        <button aria-label="Abrir menu" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-slate-100">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-white p-4">
            <div className="flex items-center justify-between">
              <Logo />
              <button aria-label="Fechar menu" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {links}
            {footer}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-8 border-r border-slate-200 bg-white p-4 lg:flex">
        <Logo className="px-2" />
        {links}
        {footer}
      </aside>
    </>
  );
}
