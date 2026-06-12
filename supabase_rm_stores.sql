-- ============================================================
-- РМ может добавлять/удалять магазины своего региона.
-- Запускать ПОСЛЕ supabase_hr_schema.sql. Идемпотентно.
-- ============================================================

create or replace function user_in_region(p_region_id bigint)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from user_regions where user_id = auth.uid() and region_id = p_region_id)
$$;

-- запись stores: admin (все) ИЛИ rm (только свой регион)
drop policy if exists "stores admin write" on stores;
drop policy if exists "stores write" on stores;
create policy "stores write" on stores for all to authenticated
  using ( is_admin() or (current_user_role() = 'rm' and user_in_region(region_id)) )
  with check ( is_admin() or (current_user_role() = 'rm' and user_in_region(region_id)) );
