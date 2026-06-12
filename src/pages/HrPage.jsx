import { useEffect, useState } from 'react'
import { Box, Paper, Typography, Alert } from '@mui/material'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import { DataGrid } from '@mui/x-data-grid'
import { supabase } from '../lib/supabase'

export default function HrPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('hr_assignments')
        .select('id, assigned_at, hr:profiles(email), vacancy:vacancies(position, store:stores(name))')
        .order('assigned_at', { ascending: false })
      if (!active) return
      if (error) setError(error.message)
      else setRows(data ?? [])
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const columns = [
    { field: 'hr', headerName: 'HR-специалист', flex: 1, minWidth: 200,
      valueGetter: (v, row) => row.hr?.email ?? '—' },
    { field: 'position', headerName: 'Вакансия', flex: 1, minWidth: 220,
      valueGetter: (v, row) => row.vacancy?.position ?? '—' },
    { field: 'store', headerName: 'Магазин', width: 200,
      valueGetter: (v, row) => row.vacancy?.store?.name ?? '—' },
    { field: 'assigned_at', headerName: 'Назначено', width: 180,
      valueGetter: (v) => v ? new Date(v).toLocaleString('ru-RU') : '—' },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <BadgeOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">HR · Ответственные за вакансии</Typography>
          <Typography variant="body2" color="text.secondary">
            Связь «HR-специалист ↔ вакансия». Таблица пока пустая — назначения добавим на следующем шаге.
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          slots={{
            noRowsOverlay: () => (
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.disabled' }}>
                <BadgeOutlinedIcon sx={{ fontSize: 40 }} />
                <Typography variant="body2">Назначений пока нет</Typography>
              </Box>
            ),
          }}
          sx={{ border: 'none' }}
        />
      </Paper>
    </Box>
  )
}
