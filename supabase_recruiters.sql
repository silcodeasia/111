-- ============================================================
-- Рекрутеры: роль hr → recruiter + закрепление магазинов (many-to-many)
-- Запускать в SQL Editor. Идемпотентно.
-- ============================================================

-- 1. Переименование роли hr → recruiter
update profiles set role = 'recruiter' where role = 'hr';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','editor','viewer','director','rm','recruiter'));

-- 2. Закрепление рекрутер ↔ магазин (один магазин — у нескольких рекрутеров)
create table if not exists recruiter_stores (
  recruiter_id uuid   references profiles(id) on delete cascade,
  store_id     bigint references stores(id)   on delete cascade,
  primary key (recruiter_id, store_id)
);
create index if not exists recruiter_stores_store_idx on recruiter_stores(store_id);

alter table recruiter_stores enable row level security;
drop policy if exists "recruiter_stores admin" on recruiter_stores;
create policy "recruiter_stores admin" on recruiter_stores for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists "recruiter_stores own read" on recruiter_stores;
create policy "recruiter_stores own read" on recruiter_stores for select to authenticated
  using (recruiter_id = auth.uid());

-- 3. Доступ к магазину учитывает и закрепление рекрутера
create or replace function user_can_access_store(p_store_id bigint)
returns boolean
language sql security definer stable set search_path = public as $$
  select
    is_admin()
    or exists (select 1 from user_stores us where us.user_id = auth.uid() and us.store_id = p_store_id)
    or exists (
      select 1 from stores s
      join user_regions ur on ur.region_id = s.region_id
      where s.id = p_store_id and ur.user_id = auth.uid()
    )
    or exists (select 1 from recruiter_stores rs where rs.recruiter_id = auth.uid() and rs.store_id = p_store_id)
$$;

-- 4. Чтение staffing/vacancies: убираем «hr читает всё», рекрутер видит только
--    свои магазины (через user_can_access_store).
drop policy if exists "staffing read" on staffing;
create policy "staffing read" on staffing for select to authenticated
  using ( is_admin() or user_can_access_store(store_id) );

drop policy if exists "vacancies read" on vacancies;
create policy "vacancies read" on vacancies for select to authenticated
  using ( is_admin() or user_can_access_store(store_id) );
