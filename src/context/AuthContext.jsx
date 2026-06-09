import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROLES } from '../lib/rbac'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(ROLES.VIEWER)
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

  // 2. Единый источник истины для роли — таблица profiles.
  //    Перечитываем при смене пользователя.
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setRole(ROLES.VIEWER)
      setRoleLoading(false)
      return
    }

    let active = true
    setRoleLoading(true)
    supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!active) return
        setRole(data?.role ?? ROLES.VIEWER)
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
    <AuthContext.Provider value={{ session, loading, role, signIn, signInWithGitHub, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри <AuthProvider>')
  return ctx
}
