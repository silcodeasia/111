import { useMemo } from 'react'
import { Box, Paper, Typography, Alert, Chip } from '@mui/material'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import { DataGrid } from '@mui/x-data-grid'
import { useAuth } from '../context/AuthContext'
import { useStores } from '../hooks/useStores'
import { useStaffing } from '../hooks/useStaffing'

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
const r1 = (x) => Math.round(x * 10) / 10

export default function RmPage() {
  const { role, regionIds } = useAuth()
  const { stores, loading: sLoading, error } = useStores()
  const { rows: staffing, planByStore, loading: stLoading } = useStaffing()

  const myStores = useMemo(() => {
    if (role === 'admin') return stores
    return stores.filter(s => regionIds.includes(s.region_id))
  }, [stores, role, regionIds])

  const agg = useMemo(() => {
    const m = new Map()
    for (const s of staffing) {
      const a = m.get(s.store_id) ?? { shtat: 0, work: 0, fakt: 0 }
      const work = num(s.zup) + num(s.neof) + num(s.stazhirovka)
      a.shtat += num(s.shtat); a.work += work
      a.fakt += Math.max(num(s.shtat) - work, 0)
      m.set(s.store_id, a)
    }
    return m
  }, [staffing])

  const gridRows = useMemo(() => myStores.map(s => {
    const a = agg.get(s.id) ?? { shtat: 0, work: 0, fakt: 0 }
    const plan = planByStore(s.id)
    const ukompl = a.shtat > 0 ? Math.round(a.work / a.shtat * 100) : 0
    return {
      id: s.id, code: s.code, name: s.name, vid: s.vid, region: s.region?.code, dm_name: s.dm_name,
      shtat: r1(a.shtat), work: r1(a.work), vsego: r1(a.fakt + plan), ukompl,
    }
  }), [myStores, agg, planByStore])

  const columns = [
    { field: 'code', headerName: 'Код', width: 80 },
    { field: 'name', headerName: 'Магазин', flex: 1, minWidth: 200 },
    { field: 'vid', headerName: 'Вид', width: 140 },
    { field: 'region', headerName: 'Регион', width: 90, renderCell: ({ value }) => value ? <Chip size="small" color="primary" label={value} /> : '—' },
    { field: 'dm_name', headerName: 'Директор', flex: 1, minWidth: 180 },
    { field: 'shtat', headerName: 'Штат', width: 90, type: 'number', headerAlign: 'center', align: 'center' },
    { field: 'work', headerName: 'Работает', width: 100, type: 'number', headerAlign: 'center', align: 'center' },
    { field: 'vsego', headerName: 'Вакансий', width: 100, type: 'number', headerAlign: 'center', align: 'center' },
    {
      field: 'ukompl', headerName: 'Укомпл.', width: 110, type: 'number', headerAlign: 'center', align: 'center',
      renderCell: ({ value }) => (
        <Typography sx={{ fontWeight: value < 90 ? 700 : 400, color: value < 90 ? 'error.main' : 'success.main' }}>{value}%</Typography>
      ),
    },
  ]

  const totalVac = gridRows.reduce((s, r) => s + r.vsego, 0)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <MapOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Региональный менеджер</Typography>
          <Typography variant="body2" color="text.secondary">Магазинов: {gridRows.length} · вакансий: {totalVac}</Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={gridRows}
          columns={columns}
          loading={sLoading || stLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          sx={{ border: 'none' }}
        />
      </Paper>
    </Box>
  )
}
