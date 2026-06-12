// Edge Function: создание пользователя администратором.
// Деплой: supabase functions deploy admin-create-user --project-ref <ref>
// service_role/anon/url доступны как env автоматически — секреты настраивать не нужно.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const ROLES = ['admin', 'editor', 'viewer', 'director', 'rm', 'hr']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey)

    // 1. Кто вызвал — валидируем токен из заголовка явно
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Нет токена авторизации' }, 401)
    const { data: { user }, error: uErr } = await admin.auth.getUser(token)
    if (uErr || !user) return json({ error: 'Не авторизован: ' + (uErr?.message ?? 'нет пользователя') }, 401)

    // 2. Проверяем, что вызвавший — admin
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return json({ error: `Требуются права администратора (роль: ${prof?.role ?? 'нет профиля'})` }, 403)

    // 3. Создаём пользователя
    const { email, password, role } = await req.json()
    if (!email || !password) return json({ error: 'Укажите email и пароль' }, 400)
    if (String(password).length < 6) return json({ error: 'Пароль не короче 6 символов' }, 400)
    const r = ROLES.includes(role) ? role : 'viewer'

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: r },
    })
    if (cErr) return json({ error: cErr.message }, 400)

    // гарантируем профиль с нужной ролью (на случай отличий триггера)
    await admin.from('profiles').upsert({ id: created.user!.id, email, role: r })

    return json({ ok: true, id: created.user!.id, role: r })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
