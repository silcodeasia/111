-- ============================================================
-- Штатное расписание (staffing) + Отчёт (report)
-- Запускать в Supabase SQL Editor ПОСЛЕ supabase_hr_schema.sql.
-- ============================================================

-- 1. Отчёт: загружается из xlsx (только подразделение + должность,
--    строки где «Попадание в отчёт»=1). Нужен для подсчёта ЗУП.
create table if not exists report (
  id            bigint generated always as identity primary key,
  store_id      bigint references stores(id) on delete set null,
  podrazdelenie text,            -- исходное имя подразделения из отчёта
  dolzhnost     text not null,   -- должность
  uploaded_at   timestamptz default now()
);
create index if not exists report_store_pos_idx on report (store_id, dolzhnost);

alter table report enable row level security;
drop policy if exists "report read" on report;
create policy "report read" on report for select to authenticated
  using ( is_admin() or current_user_role() = 'hr' );
drop policy if exists "report write" on report;
create policy "report write" on report for all to authenticated
  using ( is_admin() or current_user_role() = 'hr' )
  with check ( is_admin() or current_user_role() = 'hr' );

-- 2. Штатное расписание (стаффинг): по (магазин × должность).
--    ЗУП считается из report (count), План — из «Вакансий» (этап B),
--    пока редактируемое поле. Расчётные поля считаются на клиенте.
create table if not exists staffing (
  id           bigint generated always as identity primary key,
  store_id     bigint references stores(id) on delete cascade,
  position     text not null,          -- должность
  category     text,                   -- АУП / Линейка / Грузчики / Допек
  shtat        numeric default 0,      -- штатное расписание (кол-во ставок)
  neof         numeric default 0,      -- неоформленные (директор)
  stazhirovka  numeric default 0,      -- стажировка (директор)
  plan         numeric default 0,      -- план вакансий (этап B → из vacancies)
  opened_date  text,                   -- дата открытия вакансии
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (store_id, position)
);
create index if not exists staffing_store_idx on staffing(store_id);

drop trigger if exists staffing_updated_at on staffing;
create trigger staffing_updated_at
  before update on staffing
  for each row execute procedure set_updated_at();

alter table staffing enable row level security;
-- чтение: admin/hr — все; director/rm — свои магазины (для этапа B)
drop policy if exists "staffing read" on staffing;
create policy "staffing read" on staffing for select to authenticated
  using ( is_admin() or current_user_role() = 'hr' or user_can_access_store(store_id) );
-- запись: admin/hr (форма «Штатное расписание»)
drop policy if exists "staffing write" on staffing;
create policy "staffing write" on staffing for all to authenticated
  using ( is_admin() or current_user_role() = 'hr' )
  with check ( is_admin() or current_user_role() = 'hr' );
