// Вебхук для 1С:ЗУП — приём «Отчёта» и пересчёт ЗУП.
// Деплой: создать функцию zup-report-webhook, Verify JWT = OFF
//         (1С не имеет Supabase-сессии; защита — общий секрет ZUP_WEBHOOK_SECRET).
// Секрет задать: Dashboard → Edge Functions → Secrets → ZUP_WEBHOOK_SECRET=<длинная строка>
//
// 1С шлёт: POST <url>/zup-report-webhook
//   Header:  x-webhook-secret: <ZUP_WEBHOOK_SECRET>
//   Body:    { "rows": [ { "podrazdelenie": "...", "dolzhnost": "...", "popadanie": 1 }, ... ] }
//   (можно прислать массив целиком вместо {rows}; «Попадание в отчёт» фильтруется здесь)
import { createClient } from 'jsr:@supabase/supabase-js@2'

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// взять первое непустое значение по списку возможных имён ключей
const pick = (r: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = r[k]
    if (v !== null && v !== undefined && String(v).trim() !== '') return v
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Только POST' }, 405)

  // 1. Авторизация по общему секрету
  const secret = Deno.env.get('ZUP_WEBHOOK_SECRET')
  if (!secret) return json({ error: 'ZUP_WEBHOOK_SECRET не настроен' }, 500)
  const got = req.headers.get('x-webhook-secret')
    ?? (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (got !== secret) return json({ error: 'Неверный секрет' }, 401)

  // 2. Тело
  let body: unknown
  try { body = await req.json() } catch { return json({ error: 'Ожидается JSON' }, 400) }
  const rows: Record<string, unknown>[] = Array.isArray(body)
    ? body as Record<string, unknown>[]
    : ((body as { rows?: unknown }).rows as Record<string, unknown>[] ?? [])
  if (!Array.isArray(rows)) return json({ error: 'Ожидается массив строк (rows)' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  // 3. Справочник магазинов для сопоставления Подразделение → store_id
  const { data: stores, error: sErr } = await admin.from('stores').select('id, name')
  if (sErr) return json({ error: 'stores: ' + sErr.message }, 500)
  const byNorm = new Map((stores ?? []).map(s => [norm(s.name), s.id]))

  // 4. Фильтрация и сборка записей
  let received = 0, included = 0, unmatched = 0
  const records: { store_id: number | null; podrazdelenie: string | null; dolzhnost: string }[] = []
  for (const r of rows) {
    received++
    const pop = pick(r, ['popadanie', 'Попадание в отчёт', 'Попадание', 'popadanie_v_otchet'])
    if (pop !== null && Number(pop) !== 1) continue
    const dol = pick(r, ['dolzhnost', 'Должность', 'должность'])
    if (!dol) continue
    const pod = pick(r, ['podrazdelenie', 'Подразделение', 'подразделение'])
    included++
    const storeId = byNorm.get(norm(pod)) ?? null
    if (!storeId) unmatched++
    records.push({ store_id: storeId, podrazdelenie: pod ? String(pod) : null, dolzhnost: String(dol).trim() })
  }

  // 5. Полная замена report + пересчёт ЗУП
  const del = await admin.from('report').delete().gt('id', 0)
  if (del.error) return json({ error: 'report delete: ' + del.error.message }, 500)
  for (let i = 0; i < records.length; i += 500) {
    const { error } = await admin.from('report').insert(records.slice(i, i + 500))
    if (error) return json({ error: 'report insert: ' + error.message }, 500)
  }
  const rpc = await admin.rpc('refresh_staffing_zup')
  if (rpc.error) return json({ error: 'refresh: ' + rpc.error.message }, 500)

  return json({ ok: true, received, included, matched: included - unmatched, unmatched })
})
