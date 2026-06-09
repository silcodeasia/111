import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Список пользователей через supabase.auth.admin.
 *
 * ВАЖНО: admin.listUsers() требует service_role ключа — он не должен быть
 * доступен в браузере. В продакшене вынесите этот вызов в Edge Function:
 *
 *   // supabase/functions/list-users/index.ts
 *   import { createClient } from '@supabase/supabase-js'
 *   Deno.serve(async (req) => {
 *     const admin = createClient(
 *       Deno.env.get('SUPABASE_URL'),
 *       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 *     )
 *     const { data } = await admin.auth.admin.listUsers()
 *     return Response.json(data)
 *   })
 *
 * Здесь используется profiles-таблица как более безопасная альтернатива.
 * Схема:
 *   create table profiles (
 *     id    uuid references auth.users on delete cascade primary key,
 *     email text,
 *     name  text,
 *     role  text default 'viewer',
 *     created_at timestamptz default now()
 *   );
 *   -- RLS: только admin может читать все профили
 */
export function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const updateRole = async (userId, newRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
    if (error) throw error
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  return { users, loading, error, refetch: fetch, updateRole }
}
