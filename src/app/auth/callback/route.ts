import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Confirmação de e-mail / magic link do Supabase. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/app", url.origin));
}
