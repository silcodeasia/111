-- ============================================================
-- Карточка магазина («Пример 1 магазина») — донастройка модели
-- Запускать ПОСЛЕ supabase_vacancies_v2.sql. Идемпотентно.
-- ============================================================

-- ЗУП хранится в staffing (обновляется из отчёта) — чтобы директор видел ЗУП
alter table staffing add column if not exists zup numeric default 0;

-- План вакансии: дата начала и причины
alter table vacancies add column if not exists opened_date text;
alter table vacancies add column if not exists reason text;

-- Директор может править свой магазин в staffing (НЕОФ/Стаж); штат/категорию
-- ограничивает интерфейс (на уровне строк RLS разрешает свой магазин).
drop policy if exists "staffing write" on staffing;
create policy "staffing write" on staffing for all to authenticated
  using ( is_admin() or current_user_role() = 'hr' or (current_user_role() = 'director' and user_can_access_store(store_id)) )
  with check ( is_admin() or current_user_role() = 'hr' or (current_user_role() = 'director' and user_can_access_store(store_id)) );

-- Пересчёт ЗУП в staffing из отчёта (count по магазину+должности)
create or replace function refresh_staffing_zup()
returns void
language sql security definer set search_path = public as $$
  update staffing s set zup = coalesce((
    select count(*) from report r
    where r.store_id = s.store_id
      and lower(btrim(r.dolzhnost)) = lower(btrim(s.position))
  ), 0);
$$;

-- первичный пересчёт (если отчёт уже загружен)
select refresh_staffing_zup();
