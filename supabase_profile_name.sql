-- ============================================================
-- Правка ФИО профиля: admin — любой, пользователь — только свой.
-- Защита: не-admin не может менять свою роль (триггер).
-- Запускать ПОСЛЕ supabase_migration.sql + supabase_hr_schema.sql. Идемпотентно.
-- ============================================================

-- UPDATE профиля: admin (все) ИЛИ свой профиль
drop policy if exists "profiles: admin updates roles" on profiles;
drop policy if exists "profiles update" on profiles;
create policy "profiles update" on profiles for update to authenticated
  using ( is_admin() or id = auth.uid() )
  with check ( is_admin() or id = auth.uid() );

-- Не-admin не может менять роль (защита от эскалации)
create or replace function protect_profile_role()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on profiles;
create trigger profiles_protect_role
  before update on profiles
  for each row execute procedure protect_profile_role();
