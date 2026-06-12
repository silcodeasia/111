import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const SELECT = '*, store:stores(id, name, code, region:regions(code))'

/**
 * Штатное расписание (staffing) + ЗУП из отчёта (report).
 * ЗУП(магазин, должность) = count строк report с тем же store_id и должностью.
 */
export function useStaffing() {
  const [rows, setRows] = useState([])
  const [zupMap, setZupMap] = useState(new Map())
  const [planMap, setPlanMap] = useState(new Map())       // store|тип → qty
  const [planStoreMap, setPlanStoreMap] = useState(new Map()) // store → Σ qty
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    const [s, r, v] = await Promise.all([
      supabase.from('staffing').select(SELECT).order('store_id').order('position'),
      supabase.from('report').select('store_id, dolzhnost'),
      supabase.from('vacancies').select('store_id, vacancy_type, qty'),
    ])
    if (s.error) setError(s.error.message)
    else setRows(s.data ?? [])

    const zm = new Map()
    for (const row of (r.data ?? [])) {
      const k = `${row.store_id}|${norm(row.dolzhnost)}`
      zm.set(k, (zm.get(k) || 0) + 1)
    }
    setZupMap(zm)

    const pm = new Map(), psm = new Map()
    for (const row of (v.data ?? [])) {
      const k = `${row.store_id}|${norm(row.vacancy_type)}`
      pm.set(k, (pm.get(k) || 0) + (row.qty || 0))
      psm.set(row.store_id, (psm.get(row.store_id) || 0) + (row.qty || 0))
    }
    setPlanMap(pm); setPlanStoreMap(psm)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const zupOf = useCallback((storeId, position) => zupMap.get(`${storeId}|${norm(position)}`) ?? 0, [zupMap])
  const planOf = useCallback((storeId, position) => planMap.get(`${storeId}|${norm(position)}`) ?? 0, [planMap])
  const planByStore = useCallback((storeId) => planStoreMap.get(storeId) ?? 0, [planStoreMap])

  const update = async (id, values) => {
    const patch = {
      position: values.position,
      category: values.category ?? null,
      shtat: values.shtat ?? 0,
      neof: values.neof ?? 0,
      stazhirovka: values.stazhirovka ?? 0,
      opened_date: values.opened_date ?? null,
      // plan не пишем — он считается из «Вакансий»
    }
    const { data, error } = await supabase.from('staffing').update(patch).eq('id', id).select(SELECT).single()
    if (error) throw error
    setRows(prev => prev.map(r => r.id === id ? data : r))
    return data
  }

  const add = async ({ store_id, position, category, shtat }) => {
    const { data, error } = await supabase
      .from('staffing')
      .insert([{ store_id, position, category: category || null, shtat: shtat || 0 }])
      .select(SELECT).single()
    if (error) throw error
    setRows(prev => [...prev, data])
    return data
  }

  const remove = async (id) => {
    const { error } = await supabase.from('staffing').delete().eq('id', id)
    if (error) throw error
    setRows(prev => prev.filter(r => r.id !== id))
  }

  /** Полная замена отчёта: records = [{store_id, podrazdelenie, dolzhnost}] */
  const replaceReport = async (records) => {
    const del = await supabase.from('report').delete().gt('id', 0)
    if (del.error) throw del.error
    for (let i = 0; i < records.length; i += 500) {
      const { error } = await supabase.from('report').insert(records.slice(i, i + 500))
      if (error) throw error
    }
    await fetchAll()
  }

  const processRowUpdate = async (newRow) => update(newRow.id, newRow)
  const clearError = useCallback(() => setError(null), [])

  return { rows, zupOf, planOf, planByStore, loading, error, clearError, refetch: fetchAll, update, add, remove, replaceReport, processRowUpdate }
}
