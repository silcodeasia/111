# DataPanel — Supabase RBAC Panel

React 18 + Vite + MUI v6 + MUI X DataGrid + Supabase

## Быстрый старт

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить Supabase

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Значения берутся из: **Supabase Dashboard → Settings → API**

### 3. Создать таблицы и RLS-политики

Откройте **Supabase Dashboard → SQL Editor** и выполните файл `supabase_migration.sql`.

### 4. Запустить

```bash
npm run dev
```

---

## Структура проекта

```
src/
├── lib/
│   ├── supabase.js        # Клиент Supabase
│   └── rbac.js            # Роли, права, PERMISSIONS map
├── context/
│   └── AuthContext.jsx    # Сессия + роль + методы входа
├── hooks/
│   ├── useProducts.js     # CRUD для таблицы products
│   └── useUsers.js        # Список и обновление ролей
├── components/
│   ├── AppLayout.jsx      # Сайдбар + топбар
│   └── RoleGuard.jsx      # HOC-защита по праву
├── pages/
│   ├── LoginPage.jsx      # Вход / GitHub OAuth
│   ├── DashboardPage.jsx  # Панель + таблица прав
│   ├── ProductsPage.jsx   # DataGrid с inline-редактированием
│   ├── ProductFormPage.jsx# Форма создания / редактирования
│   └── UsersPage.jsx      # Управление пользователями (admin)
└── theme/
    └── index.js           # MUI тема (dark, Supabase green)
```

---

## Роли и права

| Право               | viewer | editor | admin |
|---------------------|:------:|:------:|:-----:|
| Просмотр записей    | ✓      | ✓      | ✓     |
| Создание записей    |        | ✓      | ✓     |
| Редактирование      |        | ✓      | ✓     |
| Удаление            |        |        | ✓     |
| Admin-поля формы    |        |        | ✓     |
| Управление ролями   |        |        | ✓     |

Права определены в `src/lib/rbac.js` → `PERMISSIONS`.
Для добавления нового права: добавьте ключ в `PERMISSIONS` и оберните нужные места в `<RoleGuard permission="...">` или `can(role, '...')`.

---

## DataGrid: inline-редактирование

Двойной клик по любой ячейке → немедленный UPDATE в Supabase.  
Реализовано через `processRowUpdate` в `useProducts.js`.

Колонки помечены `editable: can(role, 'canEdit')` — viewer не может редактировать ячейки.  
Admin видит дополнительные колонки (`internal_code`, `supplier`).

---

## Назначение роли новому пользователю

1. Пользователь регистрируется → триггер `handle_new_user` создаёт запись в `profiles` с ролью `viewer`
2. Admin открывает `/users`, выбирает нужную роль в дропдауне DataGrid
3. Обновление попадает в `profiles.role` (защищено RLS)

В продакшене смену ролей рекомендуется выполнять через **Edge Function** с `service_role` ключом:

```typescript
// supabase/functions/set-role/index.ts
Deno.serve(async (req) => {
  const { userId, role } = await req.json()
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { error } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', userId)
  return Response.json({ error: error?.message ?? null })
})
```

---

## Сборка для продакшена

```bash
npm run build
# Результат в ./dist — можно деплоить на Vercel, Netlify, любой статик-хостинг
```

---

## Деплой на Vercel

> ⚠️ Главное: `.env` намеренно в `.gitignore` и **не попадает в репозиторий**.
> Поэтому переменные нужно задать в самом Vercel, иначе сборка возьмёт
> заглушку `placeholder.supabase.co` и логин упадёт с `Failed to fetch`.

### 1. Переменные окружения

**Vercel → Project → Settings → Environment Variables** — добавьте обе
(окружения Production + Preview + Development):

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL`      | `https://<project-id>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `anon public` ключ (Settings → API) |

Vite вшивает `VITE_*` переменные **на этапе сборки**, не в рантайме — после
их изменения **обязательна пересборка**: Deployments → ⋯ → **Redeploy**
(или любой `git push`).

### 2. URL Configuration в Supabase

Чтобы работали редиректы и OAuth, добавьте адрес деплоя:

**Supabase → Authentication → URL Configuration**
- **Site URL:** `https://<project>.vercel.app`
- **Redirect URLs:** `https://<project>.vercel.app/**`

### 3. Deployment Protection (опционально)

По умолчанию превью-деплои Vercel закрыты авторизацией (анонимно отдают `401`).
Для публичной демки: **Settings → Deployment Protection → Disable**.

### Если логин падает с `Failed to fetch`

Почти всегда — не заданы env-переменные. Проверка: DevTools → **Network** →
нажать «Войти» → у упавшего запроса посмотреть **Request URL**:
- `placeholder.supabase.co` → переменные не заданы (см. шаг 1 + Redeploy)
- `<project-id>.supabase.co` → причина другая
