-- ============================================================
-- РМ может редактировать НЕОФ/Стаж (staffing) и План/Дата/Причины (vacancies)
-- по магазинам своего региона. Recruiter остаётся read-only.
-- Запускать ПОСЛЕ supabase_store_card.sql + supabase_vacancies_v2.sql. Идемпотентно.
-- ============================================================

-- staffing: запись для admin / director(свои) / rm(свой регион)
drop policy if exists "staffing write" on staffing;
create policy "staffing write" on staffing for all to authenticated
  using ( is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)) )
  with check ( is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)) );

-- vacancies: запись для admin / director(свои) / rm(свой регион)
drop policy if exists "vacancies write" on vacancies;
create policy "vacancies write" on vacancies for all to authenticated
  using ( is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)) )
  with check ( is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)) );
