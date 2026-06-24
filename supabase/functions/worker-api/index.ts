// API для Telegram Mini App «Подработки» (Фаза 1).
// Деплой: функция worker-api, Verify JWT = OFF, секрет TG_BOT_TOKEN.
// Аутентификация — подпись Telegram initData (не Supabase-сессия).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// Проверка подписи Telegram WebApp initData
async function validateInitData(initData: string, botToken: string) {
  if (!initData) return null
  const p = new URLSearchParams(initData)
  const hash = p.get('hash') ?? ''
  p.delete('hash')
  const dcs = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')
  const enc = new TextEncoder()
  const k1 = await crypto.subtle.importKey('raw', enc.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const secret = await crypto.subtle.sign('HMAC', k1, enc.encode(botToken))
  const k2 = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k2, enc.encode(dcs))
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
  if (hex !== hash) return null
  const u = p.get('user')
  return u ? JSON.parse(u) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const botToken = Deno.env.get('TG_BOT_TOKEN')!
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json()
    const tgUser = await validateInitData(body.initData, botToken)
    if (!tgUser) return json({ error: 'bad initData' }, 401)

    // белый список: если в нём есть записи — пускаем только их (по id или нику)
    const uname = tgUser.username ? String(tgUser.username).toLowerCase() : null
    const { data: allowed } = await db.rpc('tg_is_allowed', { p_tg: tgUser.id, p_username: uname })
    if (allowed === false) return json({ error: 'not_allowed' }, 403)

    const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || ('id' + tgUser.id)
    const { data: w, error: wErr } = await db.from('workers')
      .upsert({ tg_id: tgUser.id, display_name: name, username: uname }, { onConflict: 'tg_id' }).select('id').single()
    if (wErr) return json({ error: wErr.message }, 500)
    const workerId = w.id
    const action = body.action

    if (action === 'me') {
      const { data: subs } = await db.from('worker_subscriptions').select('store_id').eq('worker_id', workerId)
      return json({ worker_id: workerId, name, subscriptions: (subs || []).map(s => s.store_id) })
    }
    if (action === 'stores') {
      const { data } = await db.from('stores').select('id,name').order('name')
      return json({ stores: data || [] })
    }
    if (action === 'subscribe') {
      await db.from('worker_subscriptions').upsert({ worker_id: workerId, store_id: body.store_id })
      return json({ ok: true })
    }
    if (action === 'unsubscribe') {
      await db.from('worker_subscriptions').delete().eq('worker_id', workerId).eq('store_id', body.store_id)
      return json({ ok: true })
    }
    if (action === 'offers') {
      const { data: subs } = await db.from('worker_subscriptions').select('store_id').eq('worker_id', workerId)
      const ids = (subs || []).map(s => s.store_id)
      if (!ids.length) return json({ offers: [] })
      const today = new Date().toISOString().slice(0, 10)
      const { data: offers } = await db.from('shift_offers')
        .select('*, stores(name), shift_bookings(worker_id,status)')
        .in('store_id', ids).eq('status', 'open').gte('shift_date', today).order('shift_date')
      const out = (offers || []).map((o: any) => {
        const active = (o.shift_bookings || []).filter((b: any) => b.status === 'booked' || b.status === 'confirmed')
        return {
          id: o.id, store: o.stores?.name, position: o.position, shift_date: o.shift_date,
          starts_at: o.starts_at, ends_at: o.ends_at, pay: o.pay, pay_note: o.pay_note,
          headcount: o.headcount, taken: active.length, mine: active.some((b: any) => b.worker_id === workerId),
        }
      }).filter((o: any) => o.taken < o.headcount || o.mine)
      return json({ offers: out })
    }
    if (action === 'book') {
      const { data, error } = await db.rpc('claim_shift', { p_offer: body.offer_id, p_worker: workerId })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, code: data })
    }
    if (action === 'my_bookings') {
      const { data } = await db.from('shift_bookings')
        .select('id,code,status, shift_offers(position,shift_date,starts_at,ends_at,pay,pay_note,stores(name))')
        .eq('worker_id', workerId).neq('status', 'cancelled').order('id', { ascending: false })
      return json({ bookings: data || [] })
    }
    if (action === 'cancel_booking') {
      const { data: b } = await db.from('shift_bookings').select('offer_id')
        .eq('id', body.booking_id).eq('worker_id', workerId).single()
      await db.from('shift_bookings').update({ status: 'cancelled' }).eq('id', body.booking_id).eq('worker_id', workerId)
      if (b) await db.from('shift_offers').update({ status: 'open' }).eq('id', b.offer_id).eq('status', 'filled')
      return json({ ok: true })
    }
    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
