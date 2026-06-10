import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Вакансии. RLS сам ограничивает выборку по роли/скоупу:
 *   admin/hr — все; director/rm — доступные магазины.
 * @param {object} opts
 * @param {number} [opts.storeId] — фильтр по конкретному магазину (для формы магазина)
 */
export function useVacancies({ storeId } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('vacancies')
      .select('*, store:stores(id, name, code)')
      .order('id', { ascending: true })
    if (storeId != null) query = query.eq('store_id', storeId)
    const { data, error } = await query
    if (error) setError(error.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetch() }, [fetch])

  const update = async (id, values) => {
    // id — generated always as identity; store-join и системные поля не шлём
    const { id: _id, created_at: _c, updated_at: _u, store: _s, ...patch } = values
    const { data, error } = await supabase
      .from('vacancies')
      .update(patch)
      .eq('id', id)
      .select('*, store:stores(id, name, code)')
      .single()
    if (error) throw error
    setRows(prev => prev.map(r => r.id === id ? data : r))
    return data
  }

  const processRowUpdate = async (newRow) => update(newRow.id, newRow)

  const clearError = useCallback(() => setError(null), [])

  return { rows, loading, error, clearError, refetch: fetch, update, processRowUpdate }
}
