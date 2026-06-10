import { useEffect, useState } from 'react'
import { Box, Grid, Paper, Typography, Chip } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { ROLE_META } from '../lib/rbac'
import { supabase } from '../lib/supabase'

function StatCard({ label, value, sub, color }) {
  return (
    <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
      <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.5px', mt: 0.25, color: color ?? 'text.primary' }}>
        {value}
      </Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  )
}

const count = async (table, mod) => {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (mod) q = mod(q)
  const { count: c } = await q
  return c ?? 0
}

export default function DashboardPage() {
  const { role, session, storeIds, regionIds } = useAuth()
  const roleMeta = ROLE_META[role] ?? ROLE_META.viewer
  const [stats, setStats] = useState({ stores: '…', vacancies: '…', open: '…' })

  useEffect(() => {
    let active = true
    ;(async () => {
      const [stores, vacancies, open] = await Promise.all([
        count('stores'),
        count('vacancies'),
        count('vacancies', q => q.eq('status', 'вакансия')),
      ])
      if (active) setStats({ stores, vacancies, open })
    })()
    return () => { active = false }
  }, [])

  const scopeSub =
    role === 'director' ? `магазинов в доступе: ${storeIds.length}`
    : role === 'rm' ? `регионов в доступе: ${regionIds.length}`
    : role === 'admin' || role === 'hr' ? 'полный доступ'
    : 'доступ ограничен'

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>Добро пожаловать</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">Вы вошли как</Typography>
          <Typography variant="body2" color="text.primary">{session?.user?.email}</Typography>
          <Chip label={roleMeta.label} color={roleMeta.color} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
          <Typography variant="caption" color="text.disabled">· {scopeSub}</Typography>
        </Box>
      </Box>

      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={4}><StatCard label="Магазины" value={stats.stores} sub="в вашем доступе" color="primary.main" /></Grid>
        <Grid item xs={12} sm={4}><StatCard label="Позиции" value={stats.vacancies} sub="всего штатных строк" /></Grid>
        <Grid item xs={12} sm={4}><StatCard label="Открытые вакансии" value={stats.open} sub="статус «вакансия»" color="warning.main" /></Grid>
      </Grid>
    </Box>
  )
}
