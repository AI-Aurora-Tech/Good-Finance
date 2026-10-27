# Good Finance

Gestor financeiro pessoal com **assistente no WhatsApp** e **conexão bancária via Open Finance**.

- **Next.js 15** (App Router) — hospedado na **Vercel**
- **Supabase** — Postgres, autenticação e Row Level Security
- **Evolution API** — envio e recebimento de mensagens do WhatsApp
- **Pluggy** — agregador autorizado do **Open Finance Brasil** (contas, cartões e transações)

## Funcionalidades

| Área | O que faz |
| --- | --- |
| Painel | Saldo total, receitas/despesas do mês, gasto no cartão, gráfico de 6 meses, despesas por categoria, orçamentos |
| Lançamentos | Cadastro, edição e exclusão; filtros por mês, tipo, categoria e busca |
| Contas e cartões | Contas (corrente, poupança, carteira…) com saldo calculado; cartões com limite, fechamento e vencimento |
| Categorias | Ícone, cor e palavras-chave usadas pelo assistente do WhatsApp |
| Orçamentos | Limite mensal por categoria, com alerta visual e cópia do mês anterior |
| Metas | Valor alvo, prazo, aportes/retiradas e quanto guardar por mês |
| Open Finance | Conectar bancos pelo widget da Pluggy, sincronizar, reconectar e desconectar |
| WhatsApp | Vincular o número por código e conversar com o assistente |

### Assistente do WhatsApp

| Mensagem | Resultado |
| --- | --- |
| `gastei 50 no mercado` | Despesa de R$ 50 em Mercado |
| `uber 23,90 ontem` | Despesa com data de ontem em Transporte |
| `recebi 3000 de salário` | Receita em Salário |
| `paguei 120 de luz no cartão nubank` | Despesa lançada no cartão "Nubank" |
| `saldo` / `resumo` / `extrato` / `metas` / `categorias` | Consultas |
| `desfazer` | Remove o último lançamento feito pelo WhatsApp |
| `vincular 123456` | Conecta o número à conta (código gerado no app) |

## Como colocar no ar

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor**, cole o conteúdo de `supabase/migrations/20261027000000_init.sql` e execute
   (ou use `supabase db push` com a CLI).
3. Em **Authentication → URL Configuration**, defina o *Site URL* com o domínio do app e adicione
   `https://SEU_DOMINIO/auth/callback` em *Redirect URLs*.
4. Copie a URL do projeto, a `anon key` e a `service_role key` (Project Settings → API).

### 2. Pluggy (Open Finance)
1. Crie uma conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) e gere `Client ID` e `Client Secret`.
2. O webhook é registrado automaticamente em cada conexão
   (`https://SEU_DOMINIO/api/webhooks/pluggy?token=PLUGGY_WEBHOOK_SECRET`).
3. Para testar sem banco real, use `NEXT_PUBLIC_PLUGGY_SANDBOX=true` e o conector "Pluggy Bank"
   (usuário `user-ok`, senha `password-ok`).

### 3. Evolution API (WhatsApp)
1. Suba uma instância da [Evolution API](https://doc.evolution-api.com) (v2) e conecte um número lendo o QR Code.
2. Configure o webhook da instância:
   - URL: `https://SEU_DOMINIO/api/webhooks/evolution?token=EVOLUTION_WEBHOOK_SECRET`
   - Evento: `MESSAGES_UPSERT`
3. Preencha `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` e `NEXT_PUBLIC_WHATSAPP_NUMBER`.

### 4. Vercel
1. Importe o repositório na Vercel.
2. Cadastre todas as variáveis de `.env.example` em **Settings → Environment Variables**
   (as `NEXT_PUBLIC_*` entram no build — faça um novo deploy se alterá-las).
3. O `vercel.json` agenda `/api/cron/sync` diariamente às 09:00 UTC para atualizar os bancos conectados.

## Desenvolvimento local

```bash
cp .env.example .env.local   # preencha as chaves
npm install
npm run dev                  # http://localhost:3000
npm test                     # testes do parser do WhatsApp e do mapeamento Open Finance
npm run lint && npm run typecheck
```

Para receber webhooks localmente, exponha a porta com um túnel (ex.: `ngrok http 3000`) e use essa URL
na Evolution API e em `NEXT_PUBLIC_APP_URL`.

## Segurança

- Todas as tabelas têm **RLS**: cada usuário só acessa os próprios dados.
- Telefone e plano só podem ser alterados pelo servidor (trigger `protect_profile_fields`).
- Webhooks exigem segredo; o webhook da Pluggy nunca confia no conteúdo do evento — o item é sempre
  consultado na API da Pluggy, e a conexão só é salva se o `clientUserId` for o do usuário logado.
- O acesso Open Finance é somente leitura; o Good Finance não movimenta dinheiro.

## Estrutura

```
src/app/                 páginas (landing, login, /app/*) e rotas de API
src/app/api/webhooks/    evolution (WhatsApp) e pluggy (Open Finance)
src/app/api/cron/sync    sincronização diária (Vercel Cron)
src/lib/whatsapp/        parser de mensagens, handler do assistente, cliente Evolution
src/lib/openfinance/     cliente Pluggy, mapeamento e sincronização
src/lib/supabase/        clients (browser, server, admin) e middleware de sessão
supabase/migrations/     schema, RLS e triggers
```
