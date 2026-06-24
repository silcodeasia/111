-- ============================================================
-- Белый список Telegram-аккаунтов для подработок.
-- Логика: если в списке есть хоть одна запись — доступ/уведомления
-- только для них; если список пуст — работает для всех.
-- Запускать в SQL Editor. Идемпотентно.
-- ============================================================
create table if not exists tg_allowlist (
  tg_id bigint primary key,
  label text,
  created_at timestamptz default now()
);

alter table tg_allowlist enable row level security;
drop policy if exists "tg_allowlist admin" on tg_allowlist;
create policy "tg_allowlist admin" on tg_allowlist for all to authenticated
  using (is_admin()) with check (is_admin());

-- разрешён ли tg_id (пустой список => разрешены все)
create or replace function tg_is_allowed(p_tg bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from tg_allowlist)
      or exists (select 1 from tg_allowlist where tg_id = p_tg)
$$;

-- по умолчанию — 2 аккаунта владельца
insert into tg_allowlist (tg_id, label) values
  (8637276054, 'Silcode'),
  (1278165970, 'Pavel')
on conflict (tg_id) do nothing;
