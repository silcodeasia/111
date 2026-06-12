-- ============================================================
-- Фикс: refresh_staffing_zup без WHERE → ошибка «UPDATE requires a WHERE clause».
-- Перезаписывает функцию с явным WHERE. Запускать в SQL Editor.
-- ============================================================

create or replace function refresh_staffing_zup()
returns void
language sql security definer set search_path = public as $$
  update staffing s
  set zup = sub.cnt
  from (
    select st.id,
           coalesce((
             select count(*) from report r
             where r.store_id = st.store_id
               and lower(btrim(r.dolzhnost)) = lower(btrim(st.position))
           ), 0) as cnt
    from staffing st
  ) sub
  where s.id = sub.id
    and s.zup is distinct from sub.cnt;
$$;

-- сразу пересчитать
select refresh_staffing_zup();
