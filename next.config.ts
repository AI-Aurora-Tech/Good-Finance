import type { NextConfig } from "next";

// A URL e a chave anon do Supabase são públicas por natureza (os dados são protegidos por RLS).
// Aceitamos também os nomes sem o prefixo NEXT_PUBLIC_, porque a Vercel pode bloquear
// variáveis "públicas" que parecem chaves.
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  },
};

export default nextConfig;
