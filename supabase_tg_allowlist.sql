-- ============================================================
-- Белый список Telegram: по ID и/или @username.
-- Логика: список пуст => доступ у всех; непуст => только совпавшие по
-- tg_id ИЛИ username. Запускать в SQL Editor. Можно повторно (пересоздаёт).
-- ============================================================

-- username у работника (для фильтра пушей по нику)
alter table workers add column if not exists username text;

-- список (запись может быть по ID, по нику, или по обоим)
drop table if exists tg_allowlist cascade;
create table tg_allowlist (
  id         bigint generated always as identity primary key,
  tg_id      bigint unique,
  username   text unique,      -- без @, нижний регистр
  label      text,
  created_at timestamptz default now()
);

alter table tg_allowlist enable row level security;
drop policy if exists "tg_allowlist admin" on tg_allowlist;
create policy "tg_allowlist admin" on tg_allowlist for all to authenticated
  using (is_admin()) with check (is_admin());

-- разрешён ли пользователь (по id или нику); пустой список => все
drop function if exists tg_is_allowed(bigint);
create or replace function tg_is_allowed(p_tg bigint, p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from tg_allowlist)
      or exists (
        select 1 from tg_allowlist
        where (tg_id is not null and tg_id = p_tg)
           or (username is not null and username = lower(coalesce(p_username, '')))
      )
$$;

-- по умолчанию — 2 аккаунта владельца (по ID, надёжно)
insert into tg_allowlist (tg_id, label) values
  (8637276054, 'Silcode'),
  (1278165970, 'Pavel')
on conflict (tg_id) do nothing;
