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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. Кто вызвал — по JWT из заголовка
    const authHeader = req.headers.get('Authorization') ?? ''
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await caller.auth.getUser()
    if (uErr || !user) return json({ error: 'Не авторизован' }, 401)

    // 2. Проверяем, что вызвавший — admin
    const admin = createClient(url, serviceKey)
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return json({ error: 'Требуются права администратора' }, 403)

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
