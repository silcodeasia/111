import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY не заданы. ' +
    'Скопируйте .env.example в .env и укажите реальные значения.'
  )
}

// В проде обращаемся к Supabase через собственный домен (прокси `/sb` в vercel.json),
// чтобы обойти блокировку *.supabase.co на сетях части пользователей (директоров).
// Браузер видит только наш домен Vercel; в него уже ходит сам Vercel. В dev — напрямую.
// Прокси `/sb` включён по умолчанию в проде (обход блокировки *.supabase.co).
// На демо-стенде отключается переменной VITE_SB_PROXY=0 — тогда клиент ходит
// прямо в свой (демо) Supabase из VITE_SUPABASE_URL, без проксирования на прод.
const useProxy =
  typeof window !== 'undefined' && import.meta.env.PROD && import.meta.env.VITE_SB_PROXY !== '0'
const baseUrl = useProxy
  ? `${window.location.origin}/sb`
  : (supabaseUrl ?? 'https://placeholder.supabase.co')

export const supabase = createClient(
  baseUrl,
  supabaseAnonKey ?? 'placeholder'
)
