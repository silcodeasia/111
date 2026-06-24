// Пуш подписчикам магазина при создании новой подработки.
// Вызывается триггером БД (pg_net) на INSERT в shift_offers.
// Деплой: функция notify-new-offer, Verify JWT = OFF, секрет TG_BOT_TOKEN.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const MINIAPP_URL = 'https://shtat360-rabota.pages.dev'
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  try {
    const botToken = Deno.env.get('TG_BOT_TOKEN')!
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json().catch(() => ({}))
    const rec = body.record ?? body              // поддержим и Supabase-webhook, и плоский payload
    const storeId = rec.store_id
    if (!storeId) return json({ error: 'no store_id' }, 400)

    const { data: store } = await db.from('stores').select('name').eq('id', storeId).single()
    const { data: subs } = await db.from('worker_subscriptions')
      .select('workers(tg_id)').eq('store_id', storeId)
    const chatIds = (subs || []).map((s: any) => s.workers?.tg_id).filter(Boolean)

    const pay = rec.pay != null ? `${Number(rec.pay).toLocaleString('ru-RU')} ₸/смена` : (rec.pay_note || 'по ставке')
    const date = rec.shift_date ? String(rec.shift_date).split('-').reverse().join('.') : ''
    const text = `🗓 Новая подработка\n${store?.name || ''} · ${rec.position || ''}\n${date} · ${pay}`

    let sent = 0
    for (const chat of chatIds) {
      const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat, text,
          reply_markup: { inline_keyboard: [[{ text: 'Открыть подработки', web_app: { url: MINIAPP_URL } }]] },
        }),
      })
      if (r.ok) sent++
    }
    return json({ ok: true, subscribers: chatIds.length, sent })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
