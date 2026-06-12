-- ============================================================
-- Связь учёток директоров/РМ с данными: stores.director_id, regions.rm_id
-- Запускать ПОСЛЕ supabase_hr_schema.sql. Идемпотентно.
-- ФИО пользователя хранится в profiles.name (есть с базовой миграции).
-- ============================================================

alter table stores  add column if not exists director_id uuid references profiles(id) on delete set null;
alter table regions add column if not exists rm_id       uuid references profiles(id) on delete set null;

create index if not exists stores_director_idx on stores(director_id);
create index if not exists regions_rm_idx on regions(rm_id);

-- Права на запись stores/regions уже покрывают назначение:
--   stores  — admin или РМ своего региона (policy "stores write")
--   regions — admin (policy "regions admin write")
-- Привязку задаёт admin из диалога «Пользователи → ⚙️».
