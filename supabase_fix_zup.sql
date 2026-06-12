-- ============================================================
-- Фикс пересчёта ЗУП: надёжное сравнение должностей + WHERE.
-- Запускать в SQL Editor (повторно безопасно).
-- ============================================================

-- Нормализация текста: ё→е, nbsp→пробел, схлопывание пробелов, lower, trim
create or replace function norm_txt(t text)
returns text language sql immutable as $$
  select btrim(lower(regexp_replace(
           replace(replace(coalesce(t, ''), 'ё', 'е'), chr(160), ' '),
           '\s+', ' ', 'g')))
$$;

-- Пересчёт staffing.zup = число сотрудников отчёта по (магазин + должность)
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
               and norm_txt(r.dolzhnost) = norm_txt(st.position)
           ), 0) as cnt
    from staffing st
  ) sub
  where s.id = sub.id
    and s.zup is distinct from sub.cnt;
$$;

-- сразу пересчитать по текущему отчёту
select refresh_staffing_zup();
