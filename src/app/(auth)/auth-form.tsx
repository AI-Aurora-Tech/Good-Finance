"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Input, Logo } from "@/components/ui";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
          <form action={action} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next ?? ""} />
            {mode === "signup" && (
              <Field label="Nome">
                <Input name="full_name" required autoComplete="name" />
              </Field>
            )}
            <Field label="E-mail">
              <Input name="email" type="email" required autoComplete="email" />
            </Field>
            <Field label="Senha">
              <Input name="password" type="password" required minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </Field>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            {state?.message && <p className="text-sm text-brand-700">{state.message}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          {mode === "login" ? (
            <>Não tem conta? <Link href="/cadastro" className="font-medium text-brand-700">Cadastre-se</Link></>
          ) : (
            <>Já tem conta? <Link href="/login" className="font-medium text-brand-700">Entrar</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
