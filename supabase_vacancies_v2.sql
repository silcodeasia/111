-- ============================================================
-- Этап B — упрощённые «Вакансии» (тип вакансии + количество)
-- Запускать в SQL Editor ПОСЛЕ supabase_staffing.sql.
-- ВНИМАНИЕ: пересоздаёт таблицу vacancies (прежние строки удаляются).
-- ============================================================

drop table if exists vacancies cascade;

create table vacancies (
  id           bigint generated always as identity primary key,
  store_id     bigint references stores(id) on delete cascade,
  vacancy_type text not null,                    -- тип вакансии = должность из staffing
  qty          integer not null default 1 check (qty >= 0),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (store_id, vacancy_type)
);
create index vacancies_store_idx on vacancies(store_id);

drop trigger if exists vacancies_updated_at on vacancies;
create trigger vacancies_updated_at before update on vacancies
  for each row execute procedure set_updated_at();

-- восстановить FK hr_assignments → vacancies (таблица пустая, связь сброшена при drop cascade)
alter table hr_assignments drop constraint if exists hr_assignments_vacancy_id_fkey;
alter table hr_assignments
  add constraint hr_assignments_vacancy_id_fkey
  foreign key (vacancy_id) references vacancies(id) on delete cascade;

-- RLS: читают admin/hr/скоуп; пишут директор(свой магазин)/hr/admin
alter table vacancies enable row level security;
drop policy if exists "vacancies read" on vacancies;
create policy "vacancies read" on vacancies for select to authenticated
  using ( is_admin() or current_user_role() = 'hr' or user_can_access_store(store_id) );
drop policy if exists "vacancies write" on vacancies;
create policy "vacancies write" on vacancies for all to authenticated
  using ( is_admin() or (current_user_role() in ('director','hr') and user_can_access_store(store_id)) )
  with check ( is_admin() or (current_user_role() in ('director','hr') and user_can_access_store(store_id)) );
