// Вебхук Telegram-бота «Подработки» (Фаза 1).
// Деплой: функция tg-bot, Verify JWT = OFF, секрет TG_BOT_TOKEN.
// На /start регистрирует работника и даёт кнопку запуска Mini App.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const MINIAPP_URL = 'https://shtat360-rabota.pages.dev'

Deno.serve(async (req) => {
  try {
    const botToken = Deno.env.get('TG_BOT_TOKEN')!
    const update = await req.json().catch(() => ({}))
    const msg = update.message
    if (msg?.text && String(msg.text).startsWith('/start')) {
      const from = msg.from
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || ('id' + from.id)
      await db.from('workers').upsert({ tg_id: from.id, display_name: name }, { onConflict: 'tg_id' })
      const { data: allowed } = await db.rpc('tg_is_allowed', { p_tg: from.id })
      const payload = allowed === false
        ? { chat_id: msg.chat.id, text: 'Доступ к подработкам пока ограничен. Обратитесь к администратору сети.' }
        : {
            chat_id: msg.chat.id,
            text: 'Добро пожаловать! Открой подработки кнопкой ниже 👇 Подпишись на магазины рядом и бронируй смены.',
            reply_markup: { keyboard: [[{ text: '🗓 Открыть подработки', web_app: { url: MINIAPP_URL } }]], resize_keyboard: true },
          }
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
    }
    return new Response('ok')
  } catch (_e) {
    return new Response('ok') // боту всегда отвечаем 200, чтобы Telegram не ретраил
  }
})
