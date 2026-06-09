-- ============================================================
-- DataPanel — миграция Supabase
-- Запустите в SQL Editor вашего Supabase-проекта
-- ============================================================

-- 1. Таблица товаров
-- ============================================================
create table if not exists products (
  id            bigint generated always as identity primary key,
  name          text not null,
  sku           text unique,
  category      text,
  price         numeric(12, 2),
  stock         integer default 0,
  status        text default 'active'
                  check (status in ('active', 'inactive', 'order_only')),
  description   text,
  is_featured   boolean default false,
  -- admin-only поля
  supplier      text,
  internal_code text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Автообновление updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on products
  for each row execute procedure set_updated_at();

-- Тестовые данные
insert into products (name, sku, category, price, stock, status, is_featured) values
  ('Ноутбук Pro 15"',        'SKU-0001', 'Electronics', 99900,  12, 'active',     true),
  ('Механическая клавиатура','SKU-0002', 'Accessories',  7200,  34, 'active',     false),
  ('USB-C концентратор',     'SKU-0003', 'Accessories',  3450,   0, 'inactive',   false),
  ('Монитор 27" 4K',         'SKU-0004', 'Electronics', 54000,   5, 'active',     true),
  ('Антивирус Pro (1 год)',   'SKU-0005', 'Software',     2990, 999, 'active',    false);


-- 2. Профили пользователей (привязаны к auth.users)
-- ============================================================
create table if not exists profiles (
  id         uuid references auth.users on delete cascade primary key,
  email      text,
  name       text,
  role       text default 'viewer'
               check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz default now()
);

-- Автоматически создаём профиль при регистрации.
-- set search_path = public обязателен: без него SECURITY DEFINER-функция
-- может не найти таблицу profiles, и создание пользователя падает с
-- "Database error creating new user".
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'viewer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- 3. RLS — Row Level Security
-- ============================================================

-- Хелпер: возвращает роль текущего пользователя в обход RLS.
-- security definer => функция выполняется от владельца и НЕ запускает
-- политики profiles повторно, поэтому нет бесконечной рекурсии.
create or replace function current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- products --
alter table products enable row level security;

-- Просмотр: любой аутентифицированный
create policy "products: read for authenticated"
  on products for select
  to authenticated
  using (true);

-- Создание и обновление: editor и admin
create policy "products: write for editor+"
  on products for insert
  to authenticated
  with check (
    current_user_role() in ('editor', 'admin')
  );

create policy "products: update for editor+"
  on products for update
  to authenticated
  using (
    current_user_role() in ('editor', 'admin')
  );

-- Удаление: только admin
create policy "products: delete for admin"
  on products for delete
  to authenticated
  using (
    current_user_role() = 'admin'
  );

-- profiles --
alter table profiles enable row level security;

-- Каждый видит свой профиль
create policy "profiles: own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

-- Admin видит всех
create policy "profiles: admin reads all"
  on profiles for select
  to authenticated
  using (
    current_user_role() = 'admin'
  );

-- Admin меняет роли
create policy "profiles: admin updates roles"
  on profiles for update
  to authenticated
  using (
    current_user_role() = 'admin'
  );
