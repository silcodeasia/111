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
const baseUrl =
  (typeof window !== 'undefined' && import.meta.env.PROD)
    ? `${window.location.origin}/sb`
    : (supabaseUrl ?? 'https://placeholder.supabase.co')

export const supabase = createClient(
  baseUrl,
  supabaseAnonKey ?? 'placeholder'
)
