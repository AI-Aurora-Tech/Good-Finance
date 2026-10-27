# Passo a passo: colocar o Good Finance no ar

Guia para publicar o app em produção. Siga na ordem — algumas etapas dependem da URL gerada nas anteriores.

**Tempo estimado:** 1h30 a 2h na primeira vez.

| Serviço | Para quê | Custo para começar |
| --- | --- | --- |
| GitHub | Código-fonte | Grátis |
| Supabase | Banco de dados e login | Grátis (plano Free) |
| Vercel | Hospedagem do app + rotina diária | Grátis (Hobby) — use Pro se o uso for comercial |
| Pluggy | Open Finance (bancos) | Sandbox grátis; produção exige contrato |
| Servidor com Docker (VPS) | Evolution API (WhatsApp) | ~R$ 25–60/mês |
| Chip de WhatsApp | Número do assistente | Um número dedicado |

---

## Etapa 0 — Deixar o código na branch `main`

O código do app está no pull request
[AI-Aurora-Tech/Good-Finance#1](https://github.com/AI-Aurora-Tech/Good-Finance/pull/1), ainda como rascunho.

1. Abra o PR, clique em **Ready for review** e depois em **Merge pull request**.
2. Confira que a `main` agora tem as pastas `src/` e `supabase/`.

> A Vercel publica a partir da `main`. Sem esse merge, não há app para publicar.

---

## Etapa 1 — Gerar os segredos

São 3 senhas aleatórias que protegem os webhooks e a rotina diária. Gere cada uma em um terminal:

```bash
openssl rand -hex 32   # EVOLUTION_WEBHOOK_SECRET
openssl rand -hex 32   # PLUGGY_WEBHOOK_SECRET
openssl rand -hex 32   # CRON_SECRET
```

Sem terminal? Use um gerador de senhas com 64 caracteres, só letras e números.

Guarde tudo num gerenciador de senhas. Ao longo do guia você vai juntar estes valores:

```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=goodfinance
EVOLUTION_WEBHOOK_SECRET=
NEXT_PUBLIC_WHATSAPP_NUMBER=
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
PLUGGY_WEBHOOK_SECRET=
NEXT_PUBLIC_PLUGGY_SANDBOX=true
CRON_SECRET=
```

---

## Etapa 2 — Supabase (banco de dados e login)

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New project**.
   - Região: **South America (São Paulo)**.
   - Anote a senha do banco.
2. Quando o projeto terminar de criar, vá em **SQL Editor → New query**.
3. Cole o conteúdo inteiro de `supabase/migrations/20261027000000_init.sql` e clique em **Run**.
   Deve aparecer *Success. No rows returned*.
4. Confira em **Table Editor**: devem existir tabelas como `profiles`, `accounts`, `transactions`, `categories`, `bank_connections`.
5. Vá em **Project Settings → API** (ou **API Keys**) e copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ A `service_role` dá acesso total ao banco. Nunca coloque em código, print ou mensagem.

As URLs de login (Authentication → URL Configuration) ficam para a Etapa 4, depois que tivermos o endereço do app.

---

## Etapa 3 — Vercel (publicar o app)

1. Crie uma conta em [vercel.com](https://vercel.com) entrando com o GitHub.
2. **Add New → Project** → importe `AI-Aurora-Tech/Good-Finance`.
   Se o repositório não aparecer, clique em **Adjust GitHub App Permissions** e libere o acesso a ele.
3. A Vercel detecta Next.js sozinha. Não mude os comandos de build.
4. Abra **Environment Variables** e cadastre por enquanto:

   | Variável | Valor agora |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | da Etapa 2 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | da Etapa 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | da Etapa 2 |
   | `EVOLUTION_WEBHOOK_SECRET` | da Etapa 1 |
   | `PLUGGY_WEBHOOK_SECRET` | da Etapa 1 |
   | `CRON_SECRET` | da Etapa 1 |
   | `EVOLUTION_INSTANCE` | `goodfinance` |
   | `NEXT_PUBLIC_PLUGGY_SANDBOX` | `true` |

5. Clique em **Deploy**. Em 2–3 minutos você recebe um endereço como `https://good-finance-xxxx.vercel.app`.
6. (Opcional) Domínio próprio: **Settings → Domains → Add**, e crie no seu provedor de domínio o registro DNS que a Vercel indicar.
7. Cadastre `NEXT_PUBLIC_APP_URL` com o endereço final (domínio próprio, se tiver), **sem barra no final**.
   Ex.: `https://app.goodfinance.com.br`
8. **Deployments → ⋯ no último deploy → Redeploy**.

> Variáveis que começam com `NEXT_PUBLIC_` só passam a valer depois de um novo deploy. Sempre faça **Redeploy** ao alterá-las.

A rotina diária de sincronização dos bancos (`vercel.json`, todo dia às 09:00 UTC = 06:00 de Brasília) é criada automaticamente. Confira em **Settings → Cron Jobs**.

---

## Etapa 4 — Ligar o login do Supabase ao app

1. No Supabase: **Authentication → URL Configuration**.
2. **Site URL**: o endereço do app (ex.: `https://app.goodfinance.com.br`).
3. **Redirect URLs** → adicione: `https://app.goodfinance.com.br/auth/callback`
4. Salve.

**Teste:** abra o app → **Criar conta** → confirme o e-mail recebido → você deve cair no painel (`/app`).

**Recomendado para produção:** o e-mail padrão do Supabase envia poucas mensagens por hora. Configure um SMTP próprio
(Resend, Brevo, Amazon SES…) em **Project Settings → Authentication → SMTP Settings**, senão novos cadastros podem não receber a confirmação.

---

## Etapa 5 — Pluggy (Open Finance)

1. Crie uma conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai).
2. Crie uma aplicação e copie **Client ID** e **Client Secret**.
3. Na Vercel, cadastre `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` e faça **Redeploy**.
4. Não é preciso configurar webhook no painel da Pluggy: o app informa o endereço sozinho a cada conexão.

**Teste (sandbox):** no app, vá em **Open Finance → Conectar banco** → escolha **Pluggy Bank** → usuário `user-ok`, senha `password-ok`.
Em até 1–2 minutos as contas e transações de teste aparecem em **Contas** e **Lançamentos**.

**Para usar bancos reais:**
1. Solicite à Pluggy a liberação de produção (exige contrato com eles).
2. Mude `NEXT_PUBLIC_PLUGGY_SANDBOX` para `false` na Vercel e faça **Redeploy**.

---

## Etapa 6 — Evolution API (WhatsApp)

A Evolution API é um servidor separado que mantém o WhatsApp conectado. Ela **não roda na Vercel** — precisa de um servidor ligado 24h.

### 6.1 Contratar um servidor

Qualquer VPS Linux com Docker serve (Hostinger, Contabo, DigitalOcean, Hetzner, Magalu Cloud…).
Mínimo recomendado: **2 GB de RAM, Ubuntu 24.04**. Você também precisa de um subdomínio apontando para o IP dele, ex.: `whatsapp.goodfinance.com.br`.

> Alternativa sem servidor próprio: contratar uma Evolution API hospedada por terceiros. Nesse caso pule para o passo 6.3 com a URL e a chave que eles fornecerem.

### 6.2 Subir a Evolution com Docker

No servidor (via SSH):

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

mkdir -p ~/evolution && cd ~/evolution
openssl rand -hex 32   # copie: será a EVOLUTION_API_KEY
```

Crie o arquivo `~/evolution/docker-compose.yml` (troque os dois valores marcados):

```yaml
services:
  evolution:
    image: evoapicloud/evolution-api:latest
    restart: always
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      SERVER_URL: https://whatsapp.goodfinance.com.br        # ← seu subdomínio
      AUTHENTICATION_API_KEY: COLE_AQUI_A_CHAVE_GERADA        # ← EVOLUTION_API_KEY
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://evolution:evolution@postgres:5432/evolution
      CACHE_REDIS_ENABLED: "true"
      CACHE_REDIS_URI: redis://redis:6379/6
      CACHE_LOCAL_ENABLED: "false"
    volumes:
      - evolution_instances:/evolution/instances
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: evolution
      POSTGRES_DB: evolution
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    restart: always
    volumes:
      - redis_data:/data

  caddy:            # HTTPS automático (Let's Encrypt)
    image: caddy:2
    restart: always
    ports: ["80:80", "443:443"]
    command: caddy reverse-proxy --from whatsapp.goodfinance.com.br --to evolution:8080   # ← seu subdomínio
    volumes:
      - caddy_data:/data

volumes:
  evolution_instances:
  pg_data:
  redis_data:
  caddy_data:
```

Suba tudo:

```bash
docker compose up -d
docker compose logs -f evolution   # Ctrl+C para sair quando aparecer "HTTP - ON"
```

Abra `https://whatsapp.goodfinance.com.br/manager` no navegador — deve aparecer o painel da Evolution.

> O Postgres e o Redis não ficam expostos para a internet (só a Evolution, via Caddy). Mesmo assim, se quiser, troque a senha `evolution` do Postgres nas duas linhas onde ela aparece.

### 6.3 Conectar o número do WhatsApp

1. No painel `/manager`, entre com a `EVOLUTION_API_KEY`.
2. **Create Instance**: nome `goodfinance`, integração **Baileys**.
3. Clique em **Connect / QR Code** e leia o QR com o WhatsApp do número do assistente
   (no celular: **Configurações → Dispositivos conectados → Conectar dispositivo**).
4. O status deve ficar **open / connected**.

> Use um número dedicado ao assistente, não o seu pessoal.

### 6.4 Configurar o webhook (WhatsApp → app)

No painel da instância, abra **Webhook** (ou **Events → Webhook**) e preencha:

- **Enabled**: ligado
- **URL**: `https://app.goodfinance.com.br/api/webhooks/evolution?token=SEU_EVOLUTION_WEBHOOK_SECRET`
- **Webhook by events**: desligado
- **Base64**: desligado
- **Eventos**: marque só **MESSAGES_UPSERT**

Ou, pelo terminal:

```bash
curl -X POST "https://whatsapp.goodfinance.com.br/webhook/set/goodfinance" \
  -H "apikey: SUA_EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d '{"webhook":{"enabled":true,"url":"https://app.goodfinance.com.br/api/webhooks/evolution?token=SEU_EVOLUTION_WEBHOOK_SECRET","byEvents":false,"base64":false,"events":["MESSAGES_UPSERT"]}}'
```

### 6.5 Informar a Evolution ao app

Na Vercel, cadastre e depois faça **Redeploy**:

| Variável | Valor |
| --- | --- |
| `EVOLUTION_API_URL` | `https://whatsapp.goodfinance.com.br` |
| `EVOLUTION_API_KEY` | a chave gerada no 6.2 |
| `EVOLUTION_INSTANCE` | `goodfinance` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | número do assistente com DDI, só dígitos. Ex.: `5511999998888` |

**Teste:** no app, vá em **WhatsApp → Gerar código**. Mande `vincular 123456` (com o seu código) para o número do assistente.
Depois envie `gastei 50 no mercado` — o lançamento deve aparecer em **Lançamentos**.

---

## Etapa 7 — Checklist final

- [ ] PR mesclado na `main`
- [ ] SQL executado no Supabase (tabelas criadas)
- [ ] Todas as 14 variáveis cadastradas na Vercel e **Redeploy** feito depois da última mudança
- [ ] Site URL e Redirect URL configurados no Supabase
- [ ] Cadastro + confirmação de e-mail funcionando
- [ ] Banco de teste (Pluggy Bank) conectado e transações importadas
- [ ] WhatsApp conectado (status *open*), número vinculado e `gastei 50 no mercado` registrado
- [ ] **Settings → Cron Jobs** na Vercel mostra `/api/cron/sync`
- [ ] SMTP próprio configurado no Supabase
- [ ] (Bancos reais) produção liberada na Pluggy e `NEXT_PUBLIC_PLUGGY_SANDBOX=false`

---

## Se algo der errado

| Sintoma | O que verificar |
| --- | --- |
| Build falha na Vercel | Leia o log em **Deployments**. Confira se as variáveis `NEXT_PUBLIC_SUPABASE_*` estão cadastradas. |
| Erro "Variável de ambiente ausente: X" | Cadastre `X` na Vercel e faça **Redeploy**. |
| E-mail de confirmação não chega | Limite do e-mail padrão do Supabase — configure SMTP próprio (Etapa 4). Veja também a caixa de spam. |
| Link do e-mail leva para `localhost` | **Site URL** no Supabase e `NEXT_PUBLIC_APP_URL` na Vercel devem ter o endereço de produção. |
| "Não foi possível iniciar a conexão com o banco" | `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` errados, ou falta **Redeploy**. Veja **Logs** na Vercel. |
| Banco conecta mas não aparecem transações | `NEXT_PUBLIC_APP_URL` precisa começar com `https://` (o webhook da Pluggy só é registrado assim). Clique em **Sincronizar** na tela Open Finance. |
| WhatsApp não responde | 1) Instância está *open* no `/manager`? 2) URL do webhook tem o `?token=` correto? 3) Em **Logs** da Vercel, procure `/api/webhooks/evolution` — `401` = token errado; `500` = veja a mensagem de erro. |
| App recebe a mensagem mas a resposta não chega | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` ou `EVOLUTION_INSTANCE` errados. |
| WhatsApp desconecta sozinho | Normal de tempos em tempos: leia o QR Code de novo no `/manager`. Não use o mesmo número em outro WhatsApp Web. |

Testar a rotina diária manualmente:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://app.goodfinance.com.br/api/cron/sync
# esperado: {"synced":N,"results":[...]}
```

---

## Atualizações futuras

- **Código:** cada merge na `main` gera um novo deploy automático na Vercel.
- **Banco de dados:** novas migrações em `supabase/migrations/` precisam ser executadas no **SQL Editor** (em ordem) antes do deploy que depende delas.
- **Evolution API:** no servidor, `cd ~/evolution && docker compose pull && docker compose up -d`.
