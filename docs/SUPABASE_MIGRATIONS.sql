-- ============================================================
-- Cardápio Digital Integrado Consumer - Schema completo
-- Rode este SQL no SQL Editor do seu projeto Supabase
-- (Dashboard -> SQL Editor -> New query -> cole tudo -> Run)
-- ============================================================

-- 1. ENUMS
do $$ begin
  create type public.order_status as enum (
    'pending','confirmed','preparing','ready','out_for_delivery','delivered','cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_mode as enum ('pickup','delivery','dine_in');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_role as enum ('admin','staff');
exception when duplicate_object then null; end $$;

-- 2. TABELAS

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  short_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  mode public.order_mode not null,
  status public.order_status not null default 'pending',
  customer_name text not null,
  customer_phone text not null,
  customer_address text,
  table_number text,
  notes text,
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text,
  consumer_external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_status_idx on public.orders(status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  notes text,
  subtotal numeric(10,2) not null
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_name text not null default 'Minha Lanchonete',
  phone text,
  address text,
  delivery_fee numeric(10,2) not null default 0,
  min_order_value numeric(10,2) not null default 0,
  is_open boolean not null default true,
  consumer_merchant_id text,
  consumer_token_hash text,
  updated_at timestamptz not null default now()
);

-- 3. ROLES (segura contra escalonamento de privilégio)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- 4. TRIGGER updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_orders_touch on public.orders;
create trigger trg_orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

drop trigger if exists trg_settings_touch on public.store_settings;
create trigger trg_settings_touch before update on public.store_settings
for each row execute function public.touch_updated_at();

-- 5. RLS
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.store_settings enable row level security;
alter table public.user_roles enable row level security;

-- Cardápio público: qualquer um lê categorias e produtos ativos
drop policy if exists "categorias publicas" on public.categories;
create policy "categorias publicas" on public.categories
  for select using (true);

drop policy if exists "produtos publicos" on public.products;
create policy "produtos publicos" on public.products
  for select using (true);

drop policy if exists "settings publicos" on public.store_settings;
create policy "settings publicos" on public.store_settings
  for select using (true);

-- Admin pode tudo
drop policy if exists "admin gerencia categorias" on public.categories;
create policy "admin gerencia categorias" on public.categories
  for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "admin gerencia produtos" on public.products;
create policy "admin gerencia produtos" on public.products
  for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "admin gerencia settings" on public.store_settings;
create policy "admin gerencia settings" on public.store_settings
  for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Pedidos: criação pública, leitura/edição apenas admin (operações públicas vão por service role na rota servidor)
drop policy if exists "admin le pedidos" on public.orders;
create policy "admin le pedidos" on public.orders
  for select using (public.has_role(auth.uid(),'admin'));

drop policy if exists "admin atualiza pedidos" on public.orders;
create policy "admin atualiza pedidos" on public.orders
  for update using (public.has_role(auth.uid(),'admin'));

drop policy if exists "admin le itens" on public.order_items;
create policy "admin le itens" on public.order_items
  for select using (public.has_role(auth.uid(),'admin'));

-- user_roles: usuário lê o próprio; admin gerencia
drop policy if exists "ler proprio role" on public.user_roles;
create policy "ler proprio role" on public.user_roles
  for select using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

drop policy if exists "admin gerencia roles" on public.user_roles;
create policy "admin gerencia roles" on public.user_roles
  for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- 6. SEED inicial (lanchonete de exemplo)
insert into public.store_settings (store_name, phone, address, delivery_fee, min_order_value)
select 'Burger House', '(11) 99999-0000', 'Rua das Brasas, 123 - Centro', 7.90, 25.00
where not exists (select 1 from public.store_settings);

with cat as (
  insert into public.categories (name, description, sort_order)
  values
    ('Hambúrgueres','Smash, artesanais e clássicos',1),
    ('Acompanhamentos','Batatas, onion rings e mais',2),
    ('Bebidas','Refris, sucos e cervejas',3),
    ('Sobremesas','Pra fechar com chave de ouro',4)
  on conflict do nothing
  returning id, name
)
insert into public.products (category_id, name, description, price, image_url, sort_order)
select c.id, p.name, p.description, p.price, p.image_url, p.sort_order
from (values
  ('Hambúrgueres','Smash Duplo','Dois smash burgers, queijo cheddar, cebola caramelizada e maionese da casa', 28.90, null, 1),
  ('Hambúrgueres','Bacon Lover','Burger 180g, bacon crocante, queijo, alface e tomate', 32.90, null, 2),
  ('Hambúrgueres','Veggie Burger','Burger de grão-de-bico, queijo vegano e molho especial', 26.90, null, 3),
  ('Acompanhamentos','Batata Frita G','Porção generosa de batatas crocantes', 18.90, null, 1),
  ('Acompanhamentos','Onion Rings','Anéis de cebola empanados', 16.90, null, 2),
  ('Bebidas','Coca-Cola 350ml','Latinha gelada', 6.50, null, 1),
  ('Bebidas','Suco de Laranja','Natural, 400ml', 9.90, null, 2),
  ('Sobremesas','Brownie com sorvete','Brownie quente + sorvete de creme', 15.90, null, 1)
) as p(catname, name, description, price, image_url, sort_order)
join (select id, name from public.categories) c on c.name = p.catname
on conflict do nothing;

-- 7. PARA DEFINIR UM ADMIN
-- Após criar o usuário em Authentication -> Users (ou pelo /admin/login com signup),
-- pegue o UUID do usuário e rode:
--    insert into public.user_roles (user_id, role) values ('SEU-USER-UUID-AQUI','admin');

-- ============================================================
-- MIGRAÇÃO 2: Integração oficial Programa Consumer
-- (anexada em: cardápio v2 — execute no SQL Editor depois da v1)
-- ============================================================

-- A. Códigos PDV (externalCode) em produtos e categorias
alter table public.products    add column if not exists external_code text;
alter table public.categories  add column if not exists external_code text;
create index if not exists products_external_code_idx on public.products(external_code);

-- B. Endereço estruturado, troco e documento do cliente em pedidos
alter table public.orders add column if not exists address_zip          text;
alter table public.orders add column if not exists address_state        text;
alter table public.orders add column if not exists address_city         text;
alter table public.orders add column if not exists address_neighborhood text;
alter table public.orders add column if not exists address_street       text;
alter table public.orders add column if not exists address_number       text;
alter table public.orders add column if not exists address_complement   text;
alter table public.orders add column if not exists address_reference    text;
alter table public.orders add column if not exists customer_document    text;
alter table public.orders add column if not exists change_for           numeric(10,2);
alter table public.orders add column if not exists pickup_code          text;

-- C. Tabela de eventos para o polling do Consumer
create table if not exists public.consumer_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  code text not null,        -- ex: PLC, CFM, CAN, DSP, CON, ODR
  full_code text not null,   -- ex: PLACED, CONFIRMED, CANCELLED, DISPATCHED, CONCLUDED
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists consumer_events_unack_idx
  on public.consumer_events(created_at)
  where acknowledged_at is null;

alter table public.consumer_events enable row level security;
drop policy if exists "admin le eventos consumer" on public.consumer_events;
create policy "admin le eventos consumer" on public.consumer_events
  for select using (public.has_role(auth.uid(),'admin'));

-- D. Triggers: enfileira eventos automaticamente quando pedido muda
create or replace function public.enqueue_consumer_event()
returns trigger language plpgsql
security definer set search_path = public, pg_temp as $$
declare
  v_code text;
  v_full text;
begin
  if (tg_op = 'INSERT') then
    insert into public.consumer_events(order_id, code, full_code)
    values (new.id, 'PLC', 'PLACED');
    return new;
  elsif (tg_op = 'UPDATE') and new.status is distinct from old.status then
    case new.status
      when 'confirmed'        then v_code := 'CFM'; v_full := 'CONFIRMED';
      when 'preparing'        then v_code := 'CFM'; v_full := 'CONFIRMED';
      when 'ready'            then v_code := 'RPU'; v_full := 'READY_FOR_PICKUP';
      when 'out_for_delivery' then v_code := 'DSP'; v_full := 'DISPATCHED';
      when 'delivered'        then v_code := 'CON'; v_full := 'CONCLUDED';
      when 'cancelled'        then v_code := 'CAN'; v_full := 'CANCELLED';
      else v_code := null;
    end case;
    if v_code is not null then
      insert into public.consumer_events(order_id, code, full_code)
      values (new.id, v_code, v_full);
    end if;
    return new;
  end if;
  return new;
end $$;

-- IMPORTANTE: o evento PLACED é inserido pela rota /api/public/orders no
-- backend (com service role). Por isso NÃO criamos mais o trigger de INSERT
-- aqui — ele causava duplicidade e/ou erro de RLS quando o anon tentava
-- gravar via trigger. Mantemos só o trigger de UPDATE para refletir as
-- mudanças de status feitas pelo admin no painel.
drop trigger if exists trg_orders_consumer_event_ins on public.orders;

drop trigger if exists trg_orders_consumer_event_upd on public.orders;
create trigger trg_orders_consumer_event_upd
  after update of status on public.orders
  for each row execute function public.enqueue_consumer_event();

-- Se ao criar pedido aparecer:
-- "new row violates row-level security policy for table consumer_events",
-- rode este bloco de reparo. Ele garante que o trigger rode com permissões
-- elevadas do dono da função, e não como usuário anon/authenticated.
alter function public.enqueue_consumer_event() security definer;
alter function public.enqueue_consumer_event() set search_path = public, pg_temp;
alter function public.enqueue_consumer_event() owner to postgres;
grant execute on function public.enqueue_consumer_event() to anon, authenticated, service_role;

drop trigger if exists trg_orders_consumer_event_ins on public.orders;
create trigger trg_orders_consumer_event_ins
  after insert on public.orders
  for each row execute function public.enqueue_consumer_event();

drop trigger if exists trg_orders_consumer_event_upd on public.orders;
create trigger trg_orders_consumer_event_upd
  after update of status on public.orders
  for each row execute function public.enqueue_consumer_event();

-- ============================================================
-- Importação de produtos via XLSX: coluna flexível para campos
-- desconhecidos (criada automaticamente pelo importador).
-- ============================================================
alter table public.products
  add column if not exists extra_fields jsonb not null default '{}'::jsonb;
