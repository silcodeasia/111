-- ============================================================
-- DataPanel — HR / Вакансии розницы: СХЕМА (Этап 1)
-- Запускать в Supabase SQL Editor ПОСЛЕ supabase_migration.sql.
-- Только структура (таблицы, роли, RLS) — без данных и ПДн.
-- Данные заливаются отдельными файлами _data/*.sql.
-- ============================================================

-- 0. Общая функция обновления updated_at (идемпотентно, как в базовой миграции)
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1. Доменные таблицы
-- ============================================================

-- Регионы (РМ1..РМ6); name — ФИО регионального менеджера
create table if not exists regions (
  id         bigint generated always as identity primary key,
  code       text unique not null,
  name       text,
  created_at timestamptz default now()
);

-- Магазины
create table if not exists stores (
  id         bigint generated always as identity primary key,
  code       text unique,                 -- код карточки ('356'); может быть null
  name       text not null,
  vid        text,                         -- супермаркет / микс / шоурум ...
  region_id  bigint references regions(id),
  dm_name    text,                         -- директор магазина (ФИО)
  created_at timestamptz default now()
);
create index if not exists stores_region_id_idx on stores(region_id);

-- Вакансии / штатные позиции по магазину
create table if not exists vacancies (
  id           bigint generated always as identity primary key,
  store_id     bigint references stores(id) on delete cascade,
  position     text not null,              -- должность
  category     text,                       -- АУП / Линейка
  staff_units  numeric,                    -- количество ставок
  zup_count    numeric,                    -- штатные (ЗУП)
  neof         numeric,                    -- неоформленные
  stazhirovka  numeric,                    -- стажировка
  plan         numeric,                    -- план
  status       text,                       -- 'вакансия' / null / ...
  planned_date text,                       -- дата (в excel разнобой → текст)
  reason       text,                       -- причины
  hr_user_id   uuid references profiles(id),-- ответственный HR (nullable)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists vacancies_store_id_idx on vacancies(store_id);
create index if not exists vacancies_hr_user_id_idx on vacancies(hr_user_id);

drop trigger if exists vacancies_updated_at on vacancies;
create trigger vacancies_updated_at
  before update on vacancies
  for each row execute procedure set_updated_at();

-- Связь HR ↔ вакансии (пока пустая)
create table if not exists hr_assignments (
  id          bigint generated always as identity primary key,
  hr_user_id  uuid   references profiles(id) on delete cascade,
  vacancy_id  bigint references vacancies(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (hr_user_id, vacancy_id)
);

-- ============================================================
-- 2. Расширение RBAC: новые роли + скоуп по магазинам/регионам
-- ============================================================

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','editor','viewer','director','rm','hr'));

-- Директор → набор магазинов
create table if not exists user_stores (
  user_id  uuid   references profiles(id) on delete cascade,
  store_id bigint references stores(id) on delete cascade,
  primary key (user_id, store_id)
);

-- РМ → набор регионов (доступ ко всем магазинам региона)
create table if not exists user_regions (
  user_id   uuid   references profiles(id) on delete cascade,
  region_id bigint references regions(id) on delete cascade,
  primary key (user_id, region_id)
);

-- ============================================================
-- 3. Хелперы доступа (SECURITY DEFINER → обходят RLS, без рекурсии)
-- ============================================================

create or replace function is_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'admin', false)
$$;

create or replace function user_can_access_store(p_store_id bigint)
returns boolean
language sql security definer stable set search_path = public as $$
  select
    is_admin()
    or exists (
      select 1 from user_stores us
      where us.user_id = auth.uid() and us.store_id = p_store_id
    )
    or exists (
      select 1 from stores s
      join user_regions ur on ur.region_id = s.region_id
      where s.id = p_store_id and ur.user_id = auth.uid()
    )
$$;

-- ============================================================
-- 4. RLS
-- ============================================================

-- regions: чтение всем аутентифицированным, запись admin
alter table regions enable row level security;
drop policy if exists "regions read" on regions;
create policy "regions read" on regions for select to authenticated using (true);
drop policy if exists "regions admin write" on regions;
create policy "regions admin write" on regions for all to authenticated
  using (is_admin()) with check (is_admin());

-- stores: чтение всем (для списков), запись admin
alter table stores enable row level security;
drop policy if exists "stores read" on stores;
create policy "stores read" on stores for select to authenticated using (true);
drop policy if exists "stores admin write" on stores;
create policy "stores admin write" on stores for all to authenticated
  using (is_admin()) with check (is_admin());

-- vacancies:
--   read  — admin/hr все; director/rm — доступные магазины
--   write — admin все; director — свои магазины; rm — read-only
--   delete— admin
alter table vacancies enable row level security;
drop policy if exists "vacancies read scoped" on vacancies;
create policy "vacancies read scoped" on vacancies for select to authenticated
  using ( is_admin() or current_user_role() = 'hr' or user_can_access_store(store_id) );
drop policy if exists "vacancies insert" on vacancies;
create policy "vacancies insert" on vacancies for insert to authenticated
  with check ( is_admin() or (current_user_role() = 'director' and user_can_access_store(store_id)) );
drop policy if exists "vacancies update" on vacancies;
create policy "vacancies update" on vacancies for update to authenticated
  using ( is_admin() or (current_user_role() = 'director' and user_can_access_store(store_id)) );
drop policy if exists "vacancies delete" on vacancies;
create policy "vacancies delete" on vacancies for delete to authenticated
  using ( is_admin() );

-- hr_assignments: admin/hr полный доступ
alter table hr_assignments enable row level security;
drop policy if exists "hr_assign read" on hr_assignments;
create policy "hr_assign read" on hr_assignments for select to authenticated
  using ( is_admin() or current_user_role() = 'hr' );
drop policy if exists "hr_assign write" on hr_assignments;
create policy "hr_assign write" on hr_assignments for all to authenticated
  using ( is_admin() or current_user_role() = 'hr' )
  with check ( is_admin() or current_user_role() = 'hr' );

-- user_stores / user_regions: управляет admin, пользователь видит свои
alter table user_stores enable row level security;
drop policy if exists "user_stores admin" on user_stores;
create policy "user_stores admin" on user_stores for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists "user_stores own read" on user_stores;
create policy "user_stores own read" on user_stores for select to authenticated
  using (user_id = auth.uid());

alter table user_regions enable row level security;
drop policy if exists "user_regions admin" on user_regions;
create policy "user_regions admin" on user_regions for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists "user_regions own read" on user_regions;
create policy "user_regions own read" on user_regions for select to authenticated
  using (user_id = auth.uid());
