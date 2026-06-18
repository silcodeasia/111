-- ============================================================
-- Самовосстановление демо-данных (ДЕМО-проект).
-- Снимок эталона + reset_demo() (данные + роли/ФИО) + авто-сброс раз в час.
-- Учётки (auth.users) не трогаются — только данные и поля профилей.
-- Запускать ОДИН раз, когда данные/роли в хорошем состоянии (после сида).
-- Повторный запуск пересоздаёт снимок по текущему состоянию.
-- На предупреждение Supabase «destructive» — подтвердить запуск.
-- ============================================================

-- 1. Эталонный снимок
drop table if exists demo_seed_regions, demo_seed_stores, demo_seed_staffing,
  demo_seed_vacancies, demo_seed_user_regions, demo_seed_user_stores,
  demo_seed_recruiter_stores, demo_seed_profiles cascade;
create table demo_seed_regions          as select * from regions;
create table demo_seed_stores           as select * from stores;
create table demo_seed_staffing         as select * from staffing;
create table demo_seed_vacancies        as select * from vacancies;
create table demo_seed_user_regions     as select * from user_regions;
create table demo_seed_user_stores      as select * from user_stores;
create table demo_seed_recruiter_stores as select * from recruiter_stores;
create table demo_seed_profiles         as select id, email, name, role from profiles;

-- снимки приватные (RLS без политик → недоступны через anon/authenticated)
alter table demo_seed_regions          enable row level security;
alter table demo_seed_stores           enable row level security;
alter table demo_seed_staffing         enable row level security;
alter table demo_seed_vacancies        enable row level security;
alter table demo_seed_user_regions     enable row level security;
alter table demo_seed_user_stores      enable row level security;
alter table demo_seed_recruiter_stores enable row level security;
alter table demo_seed_profiles         enable row level security;

-- 2. Функция восстановления (данные + роли/ФИО; учётки не трогаются)
create or replace function reset_demo()
returns text language plpgsql security definer set search_path = public as $$
begin
  -- данные: чистим (дети → родители)
  delete from vacancies; delete from staffing; delete from report;
  delete from recruiter_stores; delete from user_stores; delete from user_regions;
  delete from stores; delete from regions;

  -- данные: восстанавливаем из снимка с исходными id
  insert into regions   overriding system value select * from demo_seed_regions;
  insert into stores    overriding system value select * from demo_seed_stores;
  insert into staffing  overriding system value select * from demo_seed_staffing;
  insert into vacancies overriding system value select * from demo_seed_vacancies;
  insert into user_regions     select * from demo_seed_user_regions;
  insert into user_stores      select * from demo_seed_user_stores;
  insert into recruiter_stores select * from demo_seed_recruiter_stores;

  -- счётчики id
  perform setval(pg_get_serial_sequence('regions','id'),   coalesce((select max(id) from regions),1));
  perform setval(pg_get_serial_sequence('stores','id'),    coalesce((select max(id) from stores),1));
  perform setval(pg_get_serial_sequence('staffing','id'),  coalesce((select max(id) from staffing),1));
  perform setval(pg_get_serial_sequence('vacancies','id'), coalesce((select max(id) from vacancies),1));

  -- профили: восстанавливаем роли и ФИО (триггер защиты роли временно off)
  alter table profiles disable trigger profiles_protect_role;
  update profiles p set role = s.role, name = s.name
    from demo_seed_profiles s where p.id = s.id;
  alter table profiles enable trigger profiles_protect_role;

  return 'demo restored at ' || now();
end; $$;

-- вызывать может только залогиненный пользователь (и cron); аноним — нет
revoke all on function reset_demo() from public, anon;
grant execute on function reset_demo() to authenticated;

-- 3. Авто-сброс раз в час через pg_cron
create extension if not exists pg_cron;
select cron.unschedule('reset-demo-hourly')
  where exists (select 1 from cron.job where jobname = 'reset-demo-hourly');
select cron.unschedule('reset-demo-nightly')
  where exists (select 1 from cron.job where jobname = 'reset-demo-nightly');
select cron.schedule('reset-demo-hourly', '0 * * * *', $$select reset_demo();$$);

-- Проверка вручную:  select reset_demo();
