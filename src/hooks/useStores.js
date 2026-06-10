import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Магазины + регионы. RLS: stores читают все аутентифицированные,
 * фактический скоуп (директор/РМ) применяется в UI через useAuth().storeIds/regionIds.
 */
export function useStores() {
  const [stores, setStores] = useState([])
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [s, r] = await Promise.all([
      supabase.from('stores').select('*, region:regions(code, name)').order('name'),
      supabase.from('regions').select('*').order('code'),
    ])
    if (s.error) setError(s.error.message)
    else setStores(s.data ?? [])
    if (!r.error) setRegions(r.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { stores, regions, loading, error, refetch: fetch }
}
