import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROLES } from '../lib/rbac'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(ROLES.VIEWER)
  const [storeIds, setStoreIds] = useState([])   // скоуп директора (user_stores)
  const [regionIds, setRegionIds] = useState([]) // скоуп РМ (user_regions)
  const [recruiterStoreIds, setRecruiterStoreIds] = useState([]) // скоуп рекрутера
  const [authResolved, setAuthResolved] = useState(false)
  const [roleLoading, setRoleLoading] = useState(true)

  // Готовность приложения: сессия определена И роль для неё загружена.
  const loading = !authResolved || (!!session?.user && roleLoading)

  // 1. Слушаем сессию. Внутри колбэка только setSession (без вызовов supabase —
  //    иначе возможен дедлок в supabase-js при await внутри onAuthStateChange).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthResolved(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthResolved(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Роль (profiles) + скоуп (user_stores / user_regions). Перечитываем при смене юзера.
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setRole(ROLES.VIEWER)
      setStoreIds([])
      setRegionIds([])
      setRecruiterStoreIds([])
      setRoleLoading(false)
      return
    }

    let active = true
    setRoleLoading(true)
    Promise.all([
      supabase.from('profiles').select('role').eq('id', userId).single(),
      supabase.from('user_stores').select('store_id').eq('user_id', userId),
      supabase.from('user_regions').select('region_id').eq('user_id', userId),
      supabase.from('recruiter_stores').select('store_id').eq('recruiter_id', userId),
    ]).then(([roleRes, storesRes, regionsRes, recruiterRes]) => {
      if (!active) return
      setRole(roleRes.data?.role ?? ROLES.VIEWER)
      setStoreIds((storesRes.data ?? []).map(r => r.store_id))
      setRegionIds((regionsRes.data ?? []).map(r => r.region_id))
      setRecruiterStoreIds((recruiterRes.data ?? []).map(r => r.store_id))
      setRoleLoading(false)
    })

    return () => { active = false }
  }, [session?.user?.id])

  const signIn = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, role, storeIds, regionIds, recruiterStoreIds, signIn, signInWithGitHub, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри <AuthProvider>')
  return ctx
}
