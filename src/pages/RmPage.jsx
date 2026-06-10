import { useMemo } from 'react'
import { Box, Paper, Typography, Alert, Chip } from '@mui/material'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import { DataGrid } from '@mui/x-data-grid'
import { useAuth } from '../context/AuthContext'
import { useStores } from '../hooks/useStores'
import { useVacancies } from '../hooks/useVacancies'

export default function RmPage() {
  const { role, regionIds } = useAuth()
  const { stores, loading: sLoading, error } = useStores()
  const { rows: vacancies, loading: vLoading } = useVacancies()

  // магазины региона(ов) РМ; admin видит все
  const myStores = useMemo(() => {
    if (role === 'admin') return stores
    return stores.filter(s => regionIds.includes(s.region_id))
  }, [stores, role, regionIds])

  // агрегаты вакансий по магазину
  const byStore = useMemo(() => {
    const m = new Map()
    for (const v of vacancies) {
      const id = v.store?.id
      if (id == null) continue
      const a = m.get(id) ?? { positions: 0, open: 0 }
      a.positions++
      if (v.status === 'вакансия') a.open++
      m.set(id, a)
    }
    return m
  }, [vacancies])

  const gridRows = useMemo(() => myStores.map(s => ({
    id: s.id,
    code: s.code,
    name: s.name,
    vid: s.vid,
    region: s.region?.code,
    dm_name: s.dm_name,
    positions: byStore.get(s.id)?.positions ?? 0,
    open: byStore.get(s.id)?.open ?? 0,
  })), [myStores, byStore])

  const columns = [
    { field: 'code', headerName: 'Код', width: 80 },
    { field: 'name', headerName: 'Магазин', flex: 1, minWidth: 200 },
    { field: 'vid', headerName: 'Вид', width: 150 },
    {
      field: 'region', headerName: 'Регион', width: 100,
      renderCell: ({ value }) => value ? <Chip size="small" color="primary" label={value} /> : '—',
    },
    { field: 'dm_name', headerName: 'Директор', flex: 1, minWidth: 180 },
    { field: 'positions', headerName: 'Позиций', width: 100, type: 'number' },
    {
      field: 'open', headerName: 'Открытых', width: 110, type: 'number',
      renderCell: ({ value }) => (
        <Typography sx={{ color: value > 0 ? 'warning.main' : 'text.secondary', fontWeight: value > 0 ? 600 : 400 }}>
          {value}
        </Typography>
      ),
    },
  ]

  const totalOpen = gridRows.reduce((s, r) => s + r.open, 0)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <MapOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Региональный менеджер</Typography>
          <Typography variant="body2" color="text.secondary">
            Магазинов: {gridRows.length} · открытых вакансий: {totalOpen}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={gridRows}
          columns={columns}
          loading={sLoading || vLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          sx={{ border: 'none' }}
        />
      </Paper>
    </Box>
  )
}
