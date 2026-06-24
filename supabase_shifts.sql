-- ============================================================
-- Подработки — Фаза 1 (тестовый режим). Управленческая часть.
-- Запускать в SQL Editor (демо; на прод — когда согласуете). Идемпотентно.
-- Заложены organizations/org_id и workers/bookings под будущие фазы.
-- ============================================================

-- организации (мультитенант-заготовка; пока одна)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
alter table stores   add column if not exists org_id uuid references organizations(id);
alter table profiles add column if not exists org_id uuid references organizations(id);

-- одна организация по умолчанию + бэкафилл существующих строк
insert into organizations (name) select 'Демо-сеть'
  where not exists (select 1 from organizations);
update stores   set org_id = (select id from organizations order by created_at limit 1) where org_id is null;
update profiles set org_id = (select id from organizations order by created_at limit 1) where org_id is null;

-- работники (Telegram identity) — нужны как FK для броней (Фаза 2 наполнит)
create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint unique,
  display_name text,
  phone text,
  med_book_ok boolean default false,
  home_org_id uuid references organizations(id),
  created_at timestamptz default now()
);
create table if not exists worker_subscriptions (
  worker_id uuid references workers(id) on delete cascade,
  store_id  bigint references stores(id) on delete cascade,
  primary key (worker_id, store_id)
);

-- подработки (создаёт директор/РМ)
create table if not exists shift_offers (
  id bigint generated always as identity primary key,
  org_id uuid references organizations(id),
  store_id bigint references stores(id) on delete cascade,
  position text,
  shift_date date not null,
  starts_at time, ends_at time,
  headcount int not null default 1 check (headcount > 0),
  pay numeric, pay_note text, notes text,
  visibility text default 'own_org',     -- own_org | marketplace (Фаза 3)
  status text default 'open',            -- open | filled | cancelled
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists shift_offers_store_idx on shift_offers(store_id, shift_date);

-- брони
create table if not exists shift_bookings (
  id bigint generated always as identity primary key,
  offer_id bigint references shift_offers(id) on delete cascade,
  worker_id uuid references workers(id) on delete cascade,
  status text default 'booked',          -- booked | confirmed | cancelled | no_show
  code text,
  created_at timestamptz default now(),
  unique (offer_id, worker_id)
);
create index if not exists shift_bookings_offer_idx on shift_bookings(offer_id);

-- автозаполнение org_id у новой подработки по магазину
create or replace function shift_offer_set_org()
returns trigger language plpgsql as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from stores where id = new.store_id;
  end if;
  return new;
end; $$;
drop trigger if exists shift_offers_org on shift_offers;
create trigger shift_offers_org before insert on shift_offers
  for each row execute procedure shift_offer_set_org();

-- ============================================================
-- RLS
-- ============================================================
alter table shift_offers enable row level security;
drop policy if exists "shift_offers read" on shift_offers;
create policy "shift_offers read" on shift_offers for select to authenticated
  using ( is_admin() or user_can_access_store(store_id) );
drop policy if exists "shift_offers write" on shift_offers;
create policy "shift_offers write" on shift_offers for all to authenticated
  using ( is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)) )
  with check ( is_admin() or (current_user_role() in ('director','rm') and user_can_access_store(store_id)) );

alter table shift_bookings enable row level security;
drop policy if exists "shift_bookings read" on shift_bookings;
create policy "shift_bookings read" on shift_bookings for select to authenticated
  using ( is_admin() or exists (select 1 from shift_offers o where o.id = offer_id and user_can_access_store(o.store_id)) );
drop policy if exists "shift_bookings manage" on shift_bookings;
create policy "shift_bookings manage" on shift_bookings for update to authenticated
  using ( is_admin() or exists (select 1 from shift_offers o where o.id = offer_id and user_can_access_store(o.store_id)) )
  with check ( is_admin() or exists (select 1 from shift_offers o where o.id = offer_id and user_can_access_store(o.store_id)) );

-- работники: управленцы читают (видеть, кто забронировал); пишет worker-api (service_role)
alter table workers enable row level security;
drop policy if exists "workers read auth" on workers;
create policy "workers read auth" on workers for select to authenticated using ( true );
alter table worker_subscriptions enable row level security;
drop policy if exists "worker_subs read auth" on worker_subscriptions;
create policy "worker_subs read auth" on worker_subscriptions for select to authenticated using ( true );

-- ============================================================
-- Атомарный захват слота (для worker-api, Фаза 2)
-- ============================================================
create or replace function claim_shift(p_offer bigint, p_worker uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_head int; v_status text; v_cnt int; v_code text;
begin
  select headcount, status into v_head, v_status from shift_offers where id = p_offer for update;
  if v_status is null then raise exception 'offer not found'; end if;
  if v_status <> 'open' then raise exception 'closed'; end if;
  select count(*) into v_cnt from shift_bookings
    where offer_id = p_offer and status in ('booked','confirmed');
  if v_cnt >= v_head then raise exception 'full'; end if;
  v_code := upper(substr(md5(random()::text), 1, 6));
  insert into shift_bookings(offer_id, worker_id, code) values (p_offer, p_worker, v_code);
  if v_cnt + 1 >= v_head then update shift_offers set status = 'filled' where id = p_offer; end if;
  return v_code;
end; $$;
