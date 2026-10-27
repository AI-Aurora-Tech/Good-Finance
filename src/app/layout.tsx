import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Good Finance — controle financeiro pelo WhatsApp", template: "%s · Good Finance" },
  description:
    "Organize suas finanças pelo WhatsApp e conecte seus bancos com Open Finance. Gastos, receitas, cartões, orçamentos e metas em um só lugar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
