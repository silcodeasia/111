-- ============================================================
-- Штат360 — КОНСОЛИДИРОВАННАЯ СХЕМА (итоговое состояние прода)
-- Для свежего проекта (демо). Запускать ОДИН раз в SQL Editor.
-- Только структура: таблицы, функции, RLS, триггеры. Данные — отдельным сидом.
-- ============================================================

-- ---------- 0. Общий триггер updated_at ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ============================================================
-- 1. ТАБЛИЦЫ
-- ============================================================

-- products (демо-витрина RBAC; в HR-части не используется, оставлено для совместимости)
create table if not exists products (
  id bigint generated always as identity primary key,
  name text not null, sku text unique, category text,
  price numeric(12,2), stock integer default 0,
  status text default 'active' check (status in ('active','inactive','order_only')),
  description text, is_featured boolean default false,
  supplier text, internal_code text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- профили (привязка к auth.users); итоговый набор ролей
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text, name text,
  role text default 'viewer',
  created_at timestamptz default now()
);
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','editor','viewer','director','rm','recruiter'));

-- регионы (РМ) + ссылка на учётку РМ
create table if not exists regions (
  id bigint generated always as identity primary key,
  code text unique not null, name text,
  rm_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists regions_rm_idx on regions(rm_id);

-- магазины + ссылка на учётку директора
create table if not exists stores (
  id bigint generated always as identity primary key,
  code text unique, name text not null, vid text,
  region_id bigint references regions(id),
  dm_name text,
  director_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists stores_region_id_idx on stores(region_id);
create index if not exists stores_director_idx on stores(director_id);

-- скоуп: директор → магазины, РМ → регионы, рекрутер → магазины
create table if not exists user_stores (
  user_id uuid references profiles(id) on delete cascade,
  store_id bigint references stores(id) on delete cascade,
  primary key (user_id, store_id)
);
create table if not exists user_regions (
  user_id uuid references profiles(id) on delete cascade,
  region_id bigint references regions(id) on delete cascade,
  primary key (user_id, region_id)
);
create table if not exists recruiter_stores (
  recruiter_id uuid references profiles(id) on delete cascade,
  store_id bigint references stores(id) on delete cascade,
  primary key (recruiter_id, store_id)
);
create index if not exists recruiter_stores_store_idx on recruiter_stores(store_id);

-- отчёт из 1С:ЗУП (для подсчёта ЗУП)
create table if not exists report (
  id bigint generated always as identity primary key,
  store_id bigint references stores(id) on delete set null,
  podrazdelenie text, dolzhnost text not null,
  uploaded_at timestamptz default now()
);
create index if not exists report_store_pos_idx on report (store_id, dolzhnost);

-- штатное расписание (магазин × должность)
create table if not exists staffing (
  id bigint generated always as identity primary key,
  store_id bigint references stores(id) on delete cascade,
  position text not null, category text,
  shtat numeric default 0, neof numeric default 0, stazhirovka numeric default 0,
  plan numeric default 0, opened_date text, zup numeric default 0,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (store_id, position)
);
create index if not exists staffing_store_idx on staffing(store_id);

-- вакансии (тип = должность, количество) + дата/причина
create table if not exists vacancies (
  id bigint generated always as identity primary key,
  store_id bigint references stores(id) on delete cascade,
  vacancy_type text not null,
  qty integer not null default 1 check (qty >= 0),
  opened_date text, reason text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (store_id, vacancy_type)
);
create index if not exists vacancies_store_idx on vacancies(store_id);

-- HR ↔ вакансии (не используется, оставлено для совместимости)
create table if not exists hr_assignments (
  id bigint generated always as identity primary key,
  hr_user_id uuid references profiles(id) on delete cascade,
  vacancy_id bigint references vacancies(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (hr_user_id, vacancy_id)
);

-- лиды с лендинга
create table if not exists leads (
  id bigint generated always as identity primary key,
  name text, phone text, company text,
  source text default 'landing', created_at timestamptz default now()
);

-- ============================================================
-- 2. ФУНКЦИИ (после таблиц — тела SQL валидируются по таблицам)
-- ============================================================
create or replace function current_user_role()
returns text language sql security definer stable set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'admin', false)
$$;

create or replace function user_in_region(p_region_id bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from user_regions where user_id = auth.uid() and region_id = p_region_id)
$$;

create or replace function user_can_access_store(p_store_id bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select
    is_admin()
    or exists (select 1 from user_stores us where us.user_id = auth.uid() and us.store_id = p_store_id)
    or exists (
      select 1 from stores s join user_regions ur on ur.region_id = s.region_id
      where s.id = p_store_id and ur.user_id = auth.uid()
    )
    or exists (select 1 from recruiter_stores rs where rs.recruiter_id = auth.uid() and rs.store_id = p_store_id)
$$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email,
          new.raw_user_meta_data->>'name',
          coalesce(new.raw_user_meta_data->>'role','viewer'))
  on conflict (id) do nothing;
  return new;
end; $$;

create or replace function protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end; $$;

create or replace function norm_txt(t text)
returns text language sql immutable as $$
  select btrim(lower(regexp_replace(
    replace(replace(coalesce(t,''),'ё','е'), chr(160), ' '), '\s+', ' ', 'g')))
$$;

create or replace function refresh_staffing_zup()
returns void language sql security definer set search_path = public as $$
  update staffing s set zup = sub.cnt
  from (
    select st.id, coalesce((
      select count(*) from report r
      where r.store_id = st.store_id and norm_txt(r.dolzhnost) = norm_txt(st.position)
    ), 0) as cnt
    from staffing st
  ) sub
  where s.id = sub.id and s.zup is distinct from sub.cnt;
$$;

-- ============================================================
-- 3. ТРИГГЕРЫ
-- ============================================================
drop trigger if exists products_updated_at on products;
create trigger products_updated_at before update on products
  for each row execute procedure set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure handle_new_user();

drop trigger if exists profiles_protect_role on profiles;
create trigger profiles_protect_role before update on profiles
  for each row execute procedure protect_profile_role();

drop trigger if exists staffing_updated_at on staffing;
create trigger staffing_updated_at before update on staffing
  for each row execute procedure set_updated_at();

drop trigger if exists vacancies_updated_at on vacancies;
create trigger vacancies_updated_at before update on vacancies
  for each row execute procedure set_updated_at();

-- ============================================================
-- 4. RLS
-- ============================================================
alter table products enable row level security;
drop policy if exists "products: read for authenticated" on products;
create policy "products: read for authenticated" on products for select to authenticated using (true);
drop policy if exists "products: write for editor+" on products;
create policy "products: write for editor+" on products for insert to authenticated
  with check (current_user_role() in ('editor','admin'));
drop policy if exists "products: update for editor+" on products;
create policy "products: update for editor+" on products for update to authenticated
  using (current_user_role() in ('editor','admin'));
drop policy if exists "products: delete for admin" on products;
create policy "products: delete for admin" on products for delete to authenticated
  using (current_user_role() = 'admin');

alter table profiles enable row level security;
drop policy if exists "profiles: own profile" on profiles;
create policy "profiles: own profile" on profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles: admin reads all" on profiles;
create policy "profiles: admin reads all" on profiles for select to authenticated using (is_admin());
drop policy if exists "profiles update" on profiles;
create policy "profiles update" on profiles for update to authenticated
  using (is_admin() or id = auth.uid()) with check (is_admin() or id = auth.uid());

alter table regions enable row level security;
drop policy if exists "regions read" on regions;
create policy "regions read" on regions for select to authenticated using (true);
drop policy if exists "regions admin write" on regions;
create policy "regions admin write" on regions for all to authenticated
  using (is_admin()) with check (is_admin());

alter table stores enable row level security;
drop policy if exists "stores read" on stores;
create policy "stores read" on stores for select to authenticated using (true);
drop policy if exists "stores write" on stores;
create policy "stores write" on stores for all to authenticated
  using (is_admin() or (current_user_role()='rm' and user_in_region(region_id)))
  with check (is_admin() or (current_user_role()='rm' and user_in_region(region_id)));

alter table user_stores enable row level security;
drop policy if exists "user_stores admin" on user_stores;
create policy "user_stores admin" on user_stores for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "user_stores own read" on user_stores;
create policy "user_stores own read" on user_stores for select to authenticated using (user_id = auth.uid());

alter table user_regions enable row level security;
drop policy if exists "user_regions admin" on user_regions;
create policy "user_regions admin" on user_regions for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "user_regions own read" on user_regions;
create policy "user_regions own read" on user_regions for select to authenticated using (user_id = auth.uid());

alter table recruiter_stores enable row level security;
drop policy if exists "recruiter_stores admin" on recruiter_stores;
create policy "recruiter_stores admin" on recruiter_stores for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "recruiter_stores own read" on recruiter_stores;
create policy "recruiter_stores own read" on recruiter_stores for select to authenticated using (recruiter_id = auth.uid());

alter table report enable row level security;
drop policy if exists "report read" on report;
create policy "report read" on report for select to authenticated using (is_admin());
drop policy if exists "report write" on report;
create policy "report write" on report for all to authenticated using (is_admin()) with check (is_admin());

alter table staffing enable row level security;
drop policy if exists "staffing read" on staffing;
create policy "staffing read" on staffing for select to authenticated
  using (is_admin() or user_can_access_store(store_id));
drop policy if exists "staffing write" on staffing;
create policy "staffing write" on staffing for all to authenticated
  using (is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)))
  with check (is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)));

alter table vacancies enable row level security;
drop policy if exists "vacancies read" on vacancies;
create policy "vacancies read" on vacancies for select to authenticated
  using (is_admin() or user_can_access_store(store_id));
drop policy if exists "vacancies write" on vacancies;
create policy "vacancies write" on vacancies for all to authenticated
  using (is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)))
  with check (is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)));

alter table hr_assignments enable row level security;
drop policy if exists "hr_assign all admin" on hr_assignments;
create policy "hr_assign all admin" on hr_assignments for all to authenticated using (is_admin()) with check (is_admin());

alter table leads enable row level security;
drop policy if exists "leads insert public" on leads;
create policy "leads insert public" on leads for insert to anon, authenticated with check (true);
drop policy if exists "leads admin read" on leads;
create policy "leads admin read" on leads for select to authenticated using (is_admin());
