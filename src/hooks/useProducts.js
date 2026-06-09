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
    const { data, error } = await supabase
      .from('products')
      .insert([{ ...values, updated_at: new Date().toISOString() }])
      .select()
      .single()
    if (error) throw error
    setRows(prev => [data, ...prev])
    return data
  }

  const update = async (id, values) => {
    const { data, error } = await supabase
      .from('products')
      .update({ ...values, updated_at: new Date().toISOString() })
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

  return { rows, loading, error, refetch: fetch, create, update, remove, processRowUpdate }
}
