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

  // Текущий скоуп пользователя (для диалога назначений)
  const getUserScope = async (userId) => {
    const [s, r] = await Promise.all([
      supabase.from('user_stores').select('store_id').eq('user_id', userId),
      supabase.from('user_regions').select('region_id').eq('user_id', userId),
    ])
    return {
      storeIds: (s.data ?? []).map(x => x.store_id),
      regionIds: (r.data ?? []).map(x => x.region_id),
    }
  }

  // Полная замена набора магазинов/регионов пользователя (delete-then-insert)
  const setUserStores = async (userId, storeIds) => {
    const del = await supabase.from('user_stores').delete().eq('user_id', userId)
    if (del.error) throw del.error
    if (storeIds.length) {
      const { error } = await supabase
        .from('user_stores')
        .insert(storeIds.map(store_id => ({ user_id: userId, store_id })))
      if (error) throw error
    }
  }
  const setUserRegions = async (userId, regionIds) => {
    const del = await supabase.from('user_regions').delete().eq('user_id', userId)
    if (del.error) throw del.error
    if (regionIds.length) {
      const { error } = await supabase
        .from('user_regions')
        .insert(regionIds.map(region_id => ({ user_id: userId, region_id })))
      if (error) throw error
    }
  }

  return { users, loading, error, refetch: fetch, updateRole, getUserScope, setUserStores, setUserRegions }
}
