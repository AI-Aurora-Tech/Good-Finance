"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

// O widget usa APIs do navegador, então é carregado só no client.
const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((m) => m.PluggyConnect), { ssr: false });

export function ConnectBankButton({ itemId, label = "Conectar banco", variant = "primary" }: { itemId?: string; label?: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setStatus("loading");
    const res = await fetch("/api/open-finance/connect-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const body = await res.json().catch(() => ({}));
    setStatus("idle");
    if (!res.ok) return setError(body.error ?? "Não foi possível abrir a conexão.");
    setToken(body.accessToken);
  }

  async function onSuccess({ item }: { item: { id: string } }) {
    setToken(null);
    setStatus("saving");
    const res = await fetch("/api/open-finance/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    setStatus("idle");
    if (!res.ok) setError("Banco conectado, mas não foi possível salvar. Tente sincronizar novamente.");
    router.refresh();
  }

  return (
    <div>
      <Button onClick={open} disabled={status !== "idle"} variant={variant}>
        {status === "loading" ? "Abrindo…" : status === "saving" ? "Importando dados…" : label}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {token && (
        <PluggyConnect
          connectToken={token}
          updateItem={itemId}
          includeSandbox={process.env.NEXT_PUBLIC_PLUGGY_SANDBOX === "true"}
          onSuccess={onSuccess}
          onError={(e) => setError(e.message)}
          onClose={() => setToken(null)}
        />
      )}
    </div>
  );
}
