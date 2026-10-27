-- Good Finance — schema inicial
-- Execute no SQL Editor do Supabase ou via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text unique,                       -- somente dígitos, ex: 5511999998888
  whatsapp_link_code text,
  whatsapp_link_code_expires_at timestamptz,
  whatsapp_linked_at timestamptz,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Conexões Open Finance (Pluggy)
-- ---------------------------------------------------------------------------
create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'pluggy',
  item_id text not null unique,
  institution_name text,
  institution_logo text,
  status text,
  error_message text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contas bancárias / carteiras
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'checking'
    check (type in ('checking', 'savings', 'wallet', 'investment', 'other')),
  institution text,
  color text not null default '#10b981',
  initial_balance numeric(14, 2) not null default 0,
  synced_balance numeric(14, 2),           -- saldo informado pelo banco (Open Finance)
  source text not null default 'manual' check (source in ('manual', 'open_finance')),
  external_id text,
  bank_connection_id uuid references public.bank_connections (id) on delete cascade,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

-- ---------------------------------------------------------------------------
-- Cartões de crédito
-- ---------------------------------------------------------------------------
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  color text not null default '#6366f1',
  limit_amount numeric(14, 2) not null default 0,
  available_limit numeric(14, 2),          -- informado pelo banco (Open Finance)
  closing_day int not null default 1 check (closing_day between 1 and 31),
  due_day int not null default 10 check (due_day between 1 and 31),
  source text not null default 'manual' check (source in ('manual', 'open_finance')),
  external_id text,
  bank_connection_id uuid references public.bank_connections (id) on delete cascade,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text not null default '🏷️',
  color text not null default '#64748b',
  keywords text[] not null default '{}',   -- usadas pelo assistente do WhatsApp
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

-- ---------------------------------------------------------------------------
-- Lançamentos
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  description text not null,
  date date not null default current_date,
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  credit_card_id uuid references public.credit_cards (id) on delete set null,
  paid boolean not null default true,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'whatsapp', 'open_finance')),
  external_id text,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);
create index transactions_user_date_idx on public.transactions (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Orçamentos mensais por categoria
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  month date not null,                     -- sempre o dia 1 do mês
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

-- ---------------------------------------------------------------------------
-- Metas / objetivos
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0,
  deadline date,
  color text not null default '#f59e0b',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Histórico de mensagens do WhatsApp
-- ---------------------------------------------------------------------------
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  phone text not null,
  direction text not null check (direction in ('in', 'out')),
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Saldo das contas
-- ---------------------------------------------------------------------------
create view public.account_balances with (security_invoker = true) as
select
  a.*,
  case
    when a.source = 'open_finance' and a.synced_balance is not null then a.synced_balance
    else a.initial_balance + coalesce((
      select sum(case when t.type = 'income' then t.amount else -t.amount end)
      from public.transactions t
      where t.account_id = a.id and t.paid
    ), 0)
  end as balance
from public.accounts a;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.bank_connections enable row level security;
alter table public.accounts enable row level security;
alter table public.credit_cards enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy "profiles: own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Conexões são criadas pelo servidor (service role) após validar o item na Pluggy.
create policy "bank_connections: read own" on public.bank_connections
  for select using (user_id = auth.uid());

create policy "accounts: own" on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "credit_cards: own" on public.credit_cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "categories: own" on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transactions: own" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "budgets: own" on public.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals: own" on public.goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "whatsapp_messages: read own" on public.whatsapp_messages
  for select using (user_id = auth.uid());

-- Impede que o usuário altere campos sensíveis do próprio perfil pelo client.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.phone := old.phone;
    new.plan := old.plan;
    new.whatsapp_link_code := old.whatsapp_link_code;
    new.whatsapp_link_code_expires_at := old.whatsapp_link_code_expires_at;
    new.whatsapp_linked_at := old.whatsapp_linked_at;
  end if;
  return new;
end;
$$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Novo usuário: cria perfil, carteira e categorias padrão
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  insert into public.accounts (user_id, name, type, color)
  values (new.id, 'Carteira', 'wallet', '#10b981');

  insert into public.categories (user_id, name, type, icon, color, keywords) values
    (new.id, 'Alimentação',  'expense', '🍽️', '#f97316', '{restaurante,almoço,almoco,jantar,lanche,ifood,padaria,pizza,café,cafe,comida}'),
    (new.id, 'Mercado',      'expense', '🛒', '#22c55e', '{mercado,supermercado,feira,hortifruti,açougue,acougue}'),
    (new.id, 'Transporte',   'expense', '🚗', '#3b82f6', '{uber,99,gasolina,combustível,combustivel,ônibus,onibus,metrô,metro,estacionamento,pedágio,pedagio,taxi}'),
    (new.id, 'Moradia',      'expense', '🏠', '#8b5cf6', '{aluguel,condomínio,condominio,luz,energia,água,agua,internet,gás,gas,iptu}'),
    (new.id, 'Saúde',        'expense', '💊', '#ef4444', '{farmácia,farmacia,remédio,remedio,médico,medico,consulta,exame,academia,plano}'),
    (new.id, 'Educação',     'expense', '📚', '#0ea5e9', '{curso,escola,faculdade,livro,mensalidade}'),
    (new.id, 'Lazer',        'expense', '🎉', '#ec4899', '{cinema,bar,show,viagem,festa,jogo,netflix,spotify,streaming}'),
    (new.id, 'Compras',      'expense', '🛍️', '#eab308', '{roupa,shopping,presente,amazon,loja,sapato}'),
    (new.id, 'Assinaturas',  'expense', '🔁', '#14b8a6', '{assinatura,mensal}'),
    (new.id, 'Outros',       'expense', '🏷️', '#64748b', '{}'),
    (new.id, 'Salário',      'income',  '💼', '#10b981', '{salário,salario,pagamento}'),
    (new.id, 'Freelance',    'income',  '💻', '#06b6d4', '{freela,freelance,projeto,serviço,servico}'),
    (new.id, 'Investimentos','income',  '📈', '#6366f1', '{rendimento,dividendos,juros,investimento}'),
    (new.id, 'Outras receitas','income','💰', '#84cc16', '{pix,reembolso,venda}');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
