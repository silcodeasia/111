# MVP «Подработки» — Фаза 1 (черновик, не реализовано)

Внутрисетевые подработки: директор публикует разовую потребность на смену → линейные
сотрудники своей сети видят её и бронируют через Telegram. Заложен `org_id` и разделение
«управленцы/работники», чтобы Фазы 2–3 (мультитенант, кросс-сетевой пул) не требовали переписывания.

## 1. Объём MVP

**В составе:**
- `organizations` (одна сеть) + `org_id` на `stores`/`profiles`.
- Работники (Telegram-identity), подписки на магазины.
- Подработки (`shift_offers`) — создаёт директор.
- Брони (`shift_bookings`) с атомарным захватом слота + код брони.
- UI директора: создать подработку, видеть брони, отметить приход.
- Telegram Mini App работника: подписки, лента подработок, бронь, «мои брони».

**Вне MVP (Фазы 2–3):** кросс-сетевая видимость, оплата через платформу, рейтинги/штрафы за неявку,
проверка санкнижки, мультитенант-управление, SMS-авторизация.

## 2. Архитектурные принципы (forward-compat)

1. **`org_id` с самого начала** — даже при одной сети. Все управленческие данные изолируются по сети.
2. **Два типа пользователей строго раздельно:**
   - *Управленцы* — текущий Supabase Auth (email+пароль, роли), привязка `profiles.org_id`.
   - *Работники* — Telegram-identity, **без** Supabase-сессии; ходят через Edge Function-шлюз.
3. **Подработки шарятся, управленческие данные — нет.** Поле `visibility` готовит Фазу 3 (Фаза 1 = `own_org`).

## 3. Модель данных (эскиз)

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null, created_at timestamptz default now()
);

alter table stores   add column org_id uuid references organizations(id);
alter table profiles add column org_id uuid references organizations(id);

-- Работники маркетплейса (НЕ привязаны к сети). Минимум ПДн.
create table workers (
  id uuid primary key default gen_random_uuid(),
  tg_id        bigint unique not null,       -- Telegram user id (identity)
  display_name text,                          -- ввёл сам
  phone        text,                          -- опц., если сам дал
  med_book_ok  boolean default false,         -- санкнижка (Фаза 3)
  home_org_id  uuid references organizations(id),  -- "родная" сеть (опц.)
  created_at   timestamptz default now()
);

create table worker_subscriptions (           -- на какие магазины подписан
  worker_id uuid references workers(id) on delete cascade,
  store_id  bigint references stores(id) on delete cascade,
  primary key (worker_id, store_id)
);

-- Подработки (постит директор)
create table shift_offers (
  id bigint generated always as identity primary key,
  org_id     uuid   references organizations(id),     -- денорм. для изоляции/фильтра
  store_id   bigint references stores(id) on delete cascade,
  position   text,                                    -- должность
  shift_date date not null,
  starts_at  time, ends_at time,
  headcount  int  not null check (headcount > 0),     -- сколько человек нужно
  pay        numeric,                                 -- оплата за смену (опц., информативно)
  pay_note   text,                                    -- тип оплаты: "переработка 1.5×" / "отгул" и т.п.
  notes      text,
  visibility text default 'own_org',                  -- own_org | marketplace
  status     text default 'open',                     -- open | filled | cancelled
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Брони
create table shift_bookings (
  id bigint generated always as identity primary key,
  offer_id  bigint references shift_offers(id) on delete cascade,
  worker_id uuid   references workers(id) on delete cascade,
  status    text default 'booked',     -- booked | confirmed | cancelled | no_show
  code      text,                       -- одноразовый код (показать в магазине)
  created_at timestamptz default now(),
  unique (offer_id, worker_id)          -- один работник — одна бронь на оффер
);
```

## 4. Авторизация

**Управленцы** — как сейчас (Supabase Auth + роли + RLS, теперь ещё и `org_id`).

**Работники — Telegram Mini App + Edge Function-шлюз (рекомендация):**
- Telegram Mini App открывается из бота; при запуске отдаёт подписанный `initData`.
- Все действия работника идут в **Edge Function `worker-api`**, которая:
  1. валидирует `initData` (HMAC по токену бота) — это и есть аутентификация;
  2. находит/создаёт `workers` по `tg_id`;
  3. выполняет операцию через `service_role` (RLS на работников не опираемся — логику держит функция).
- **Почему так:** не плодим тысячи Supabase-юзеров, не собираем телефон/ФИО, identity на стороне Telegram. Минимум ПДн: `tg_id` + имя + код брони.
- Согласие на обработку ПДн — экран при первом входе (как на лендинге).

## 5. Атомарное бронирование (без двойных записей)

```sql
create function claim_shift(p_offer bigint, p_worker uuid)
returns text language plpgsql security definer as $$
declare v_cnt int; v_head int; v_status text; v_code text;
begin
  select headcount, status into v_head, v_status
    from shift_offers where id = p_offer for update;     -- блокировка строки
  if v_status <> 'open' then raise exception 'closed'; end if;
  select count(*) into v_cnt from shift_bookings
    where offer_id = p_offer and status in ('booked','confirmed');
  if v_cnt >= v_head then raise exception 'full'; end if;
  v_code := upper(substr(md5(random()::text),1,6));
  insert into shift_bookings(offer_id, worker_id, code) values (p_offer, p_worker, v_code);
  if v_cnt + 1 >= v_head then
    update shift_offers set status = 'filled' where id = p_offer;
  end if;
  return v_code;
end; $$;
```
- Вызывается только из `worker-api` (после валидации Telegram).
- **Realtime** (Supabase Realtime на `shift_offers`/`shift_bookings`) → у других работников подработка вживую гаснет/становится некликабельной.

## 6. UX-потоки

**Директор (в текущем приложении, новый раздел «Подработки»):**
1. На карточке магазина / в разделе — «+ Подработка»: должность, дата, кол-во, опц. время/оплата.
2. Список своих подработок со статусом (open/filled) и бронями (кто, код).
3. Отметка прихода работника (`status=confirmed`) / неявка.

**Работник (Telegram Mini App):**
1. `/start` → ввести имя (один раз) → согласие на ПДн.
2. Подписаться на магазины (поиск по названию/району «рядом с домом»).
3. Лента открытых подработок по своим магазинам (дата, магазин, должность, оплата).
4. «Забронировать» → получить **код брони** → раздел «Мои брони».
5. Слот заполнен — исчезает у других (Realtime).

## 7. Компоненты к разработке

| Компонент | Что | Переиспользуем |
|---|---|---|
| БД-миграция | новые таблицы + `claim_shift` + `org_id` | существующий Supabase |
| UI директора | раздел «Подработки» (создать/список/брони) | текущий React+MUI app |
| Telegram-бот | `/start`, открыть Mini App, уведомления | новый (token бота) |
| Mini App работника | подписки, лента, бронь, мои брони | новый небольшой web (Vercel/CF Pages) |
| Edge Function `worker-api` | валидация Telegram + операции через service_role | Supabase Functions |

## 8. Решения (зафиксировано)

1. **Авторизация работников — Telegram** (Mini App + бот). ✅
2. **Подработка привязана и к магазину, и к должности** (`store_id` + `position`). В ленте работника карточка показывает «магазин · должность · дата». ✅
3. **Оплату не проводим** (своя сеть, офлайн). Поле информативное — см. §10. ✅
4. **Без верификации работника** (своя сеть): только имя + код брони, санкнижка не проверяется. ✅
5. **Пуши нужны** — бот уведомляет подписчиков о новой подработке. См. §11. ✅

## 10. Оплата (отображение, без платежей)

- Директор при создании указывает (необязательно): `pay` (сумма ₸/смена) и/или `pay_note`
  (тип: «переработка 1.5×», «отгул взамен», «доплата по ставке»). Можно оставить пустым.
- Работник в ленте видит «чип» оплаты:
  - есть `pay` → «8 000 ₸ / смена» (зелёным);
  - нет суммы, есть `pay_note` → текст типа («Переработка 1.5×»);
  - пусто → «По ставке смены».
  - мелкой строкой: «Оплата — через расчётный лист сети (офлайн)».
- Никаких кошельков/карт/транзакций в приложении. Деньги — обычной бухгалтерией сети.

## 11. Пуш-уведомления (Telegram)

- На вставку в `shift_offers` → **Supabase Database Webhook** → Edge Function `notify-new-offer`.
- Функция берёт `worker_subscriptions` по `store_id` оффера и шлёт каждому подписчику сообщение
  ботом (`sendMessage` по `tg_id`): «Новая подработка: <магазин> · <должность> · <дата> · <оплата>» + кнопка «Открыть».
- Также уведомления работнику при подтверждении/отмене его брони директором (опц.).
- Антиспам: группировать/ограничивать частоту, если подработок много (на будущее).

## 9. Последовательность сборки (грубо)

1. Миграция БД (org + workers + offers + bookings + `claim_shift`).
2. UI директора (создание/список/брони) — внутри текущего app.
3. Edge Function `worker-api` (валидация Telegram + list/subscribe/claim).
4. Telegram-бот + Mini App (3–4 экрана).
5. Realtime-обновления + код брони/подтверждение прихода.

Каждый шаг самостоятелен; после шага 2 уже можно показывать «директорскую» часть, после шага 4 — полную петлю.
