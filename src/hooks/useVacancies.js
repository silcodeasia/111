import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Упрощённые «Вакансии»: магазин × тип вакансии × количество.
 * RLS: читают admin/hr/скоуп; пишет директор (свой магазин) / hr / admin.
 * @param {object} opts
 * @param {number} [opts.storeId] — фильтр по магазину
 */
export function useVacancies({ storeId } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    let query = supabase
      .from('vacancies')
      .select('*, store:stores(id, name, code)')
      .order('vacancy_type')
    if (storeId != null) query = query.eq('store_id', storeId)
    const { data, error } = await query
    if (error) setError(error.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetch() }, [fetch])

  const add = async ({ store_id, vacancy_type, qty }) => {
    const { data, error } = await supabase
      .from('vacancies')
      .insert([{ store_id, vacancy_type, qty: qty ?? 1 }])
      .select('*, store:stores(id, name, code)')
      .single()
    if (error) throw error
    setRows(prev => [...prev, data])
    return data
  }

  const update = async (id, values) => {
    const patch = { vacancy_type: values.vacancy_type, qty: values.qty }
    const { data, error } = await supabase
      .from('vacancies').update(patch).eq('id', id)
      .select('*, store:stores(id, name, code)').single()
    if (error) throw error
    setRows(prev => prev.map(r => r.id === id ? data : r))
    return data
  }

  const remove = async (id) => {
    const { error } = await supabase.from('vacancies').delete().eq('id', id)
    if (error) throw error
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const processRowUpdate = async (newRow) => update(newRow.id, newRow)
  const clearError = useCallback(() => setError(null), [])

  return { rows, loading, error, clearError, refetch: fetch, add, update, remove, processRowUpdate }
}
