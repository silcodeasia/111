import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * CRUD-хук для таблицы `products`.
 *
 * Минимальная схема таблицы:
 *   create table products (
 *     id          bigint generated always as identity primary key,
 *     name        text not null,
 *     sku         text unique,
 *     category    text,
 *     price       numeric(12,2),
 *     stock       integer default 0,
 *     status      text default 'active',  -- 'active' | 'inactive' | 'order_only'
 *     description text,
 *     is_featured boolean default false,
 *     supplier    text,
 *     internal_code text,               -- только admin
 *     created_at  timestamptz default now(),
 *     updated_at  timestamptz default now()
 *   );
 */
export function useProducts() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values) => {
    // updated_at/created_at проставит БД (default now() + триггер set_updated_at)
    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = values
    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single()
    if (error) throw error
    setRows(prev => [data, ...prev])
    return data
  }

  const update = async (id, values) => {
    // id — generated always as identity, его НЕЛЬЗЯ передавать в UPDATE
    // (Postgres: "column id can only be updated to DEFAULT").
    // created_at тоже не трогаем, updated_at выставит триггер set_updated_at.
    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...patch } = values
    const { data, error } = await supabase
      .from('products')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setRows(prev => prev.map(r => r.id === id ? data : r))
    return data
  }

  const remove = async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw error
    setRows(prev => prev.filter(r => r.id !== id))
  }

  /** Inline-редактирование из DataGrid: processRowUpdate */
  const processRowUpdate = async (newRow, oldRow) => {
    try {
      const updated = await update(newRow.id, newRow)
      return updated
    } catch (err) {
      // Возвращаем старую строку при ошибке — DataGrid откатит изменение
      console.error('processRowUpdate error:', err)
      throw err
    }
  }

  const clearError = useCallback(() => setError(null), [])

  return { rows, loading, error, clearError, refetch: fetch, create, update, remove, processRowUpdate }
}
