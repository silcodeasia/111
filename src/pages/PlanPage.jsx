import { useMemo } from 'react'
import { Box, Paper, Typography, Alert, Grid } from '@mui/material'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import {
  DataGrid, GridToolbarContainer, GridToolbarQuickFilter, GridToolbarExport, GridToolbarColumnsButton,
} from '@mui/x-data-grid'
import { useStores } from '../hooks/useStores'
import { useVacancies } from '../hooks/useVacancies'

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
const r1 = (x) => Math.round(x * 10) / 10 // 1 знак

function Stat({ label, value, color }) {
  return (
    <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
      <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</Typography>
      <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, mt: 0.25, color: color ?? 'text.primary' }}>{value}</Typography>
    </Paper>
  )
}

function Toolbar() {
  return (
    <GridToolbarContainer sx={{ justifyContent: 'space-between', p: 1 }}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <GridToolbarColumnsButton />
        <GridToolbarExport csvOptions={{ fileName: 'svodny_plan', utf8WithBom: true }} />
      </Box>
      <GridToolbarQuickFilter debounceMs={300} />
    </GridToolbarContainer>
  )
}

export default function PlanPage() {
  const { stores, loading: sLoading, error } = useStores()
  const { rows: vacancies, loading: vLoading } = useVacancies()

  // агрегация вакансий по магазину
  const rows = useMemo(() => {
    const agg = new Map() // store_id -> {shtat, zup, neof, stazh, vac, aup, lineyka, other}
    for (const v of vacancies) {
      const id = v.store?.id
      if (id == null) continue
      const a = agg.get(id) ?? { shtat: 0, zup: 0, neof: 0, stazh: 0, vac: 0, aup: 0, lineyka: 0, other: 0 }
      const filled = num(v.zup_count) + num(v.neof) + num(v.stazhirovka)
      const vacLine = Math.max(num(v.staff_units) - filled, 0)
      a.shtat += num(v.staff_units)
      a.zup += num(v.zup_count); a.neof += num(v.neof); a.stazh += num(v.stazhirovka)
      a.vac += vacLine
      const cat = (v.category || '').toUpperCase()
      if (cat.includes('АУП')) a.aup += vacLine
      else if (cat.includes('ЛИНЕЙК')) a.lineyka += vacLine
      else a.other += vacLine
      agg.set(id, a)
    }
    return stores.map((s, i) => {
      const a = agg.get(s.id) ?? { shtat: 0, zup: 0, neof: 0, stazh: 0, vac: 0, aup: 0, lineyka: 0, other: 0 }
      const itogo = a.zup + a.neof + a.stazh
      const ukompl = a.shtat > 0 ? (itogo / a.shtat) * 100 : 0
      return {
        id: s.id,
        n: i + 1,
        store: s.name,
        recruiter: '—',
        rm: s.region?.name ?? s.region?.code ?? '—',
        dm: s.dm_name ?? '—',
        shtat: r1(a.shtat),
        zup: r1(a.zup), neof: r1(a.neof), stazh: r1(a.stazh), itogo: r1(itogo),
        vac: r1(a.vac), aup: r1(a.aup), lineyka: r1(a.lineyka), other: r1(a.other),
        nehvatka: Math.round(100 - ukompl),
        ukompl: Math.round(ukompl),
      }
    })
  }, [vacancies, stores])

  const totals = useMemo(() => {
    const shtat = rows.reduce((s, r) => s + r.shtat, 0)
    const itogo = rows.reduce((s, r) => s + r.itogo, 0)
    const vac = rows.reduce((s, r) => s + r.vac, 0)
    return { shtat: r1(shtat), itogo: r1(itogo), vac: r1(vac), ukompl: shtat > 0 ? Math.round(itogo / shtat * 100) : 0 }
  }, [rows])

  const n = (w = 80) => ({ type: 'number', width: w, headerAlign: 'center', align: 'center' })
  const pct = (field, headerName) => ({
    field, headerName, ...n(120),
    renderCell: ({ value }) => {
      const low = field === 'ukompl' ? value < 90 : value > 10
      return <Typography sx={{ fontSize: '0.8rem', fontWeight: low ? 700 : 400, color: low ? 'error.main' : 'success.main' }}>{value}%</Typography>
    },
  })

  const columns = [
    { field: 'n', headerName: '№', width: 56, headerAlign: 'center', align: 'center' },
    { field: 'store', headerName: 'Магазин', flex: 1, minWidth: 180 },
    { field: 'recruiter', headerName: 'Рекрутер', width: 110 },
    { field: 'rm', headerName: 'РМ', width: 160 },
    { field: 'dm', headerName: 'ДМ', width: 180 },
    { field: 'shtat', headerName: 'ШТАТ', ...n(80) },
    { field: 'zup', headerName: 'ЗУП', ...n(70) },
    { field: 'neof', headerName: 'НЕОФ', ...n(70) },
    { field: 'stazh', headerName: 'СТАЖ', ...n(70) },
    { field: 'itogo', headerName: 'ИТОГО', ...n(80) },
    { field: 'vac', headerName: 'Вакансий', ...n(90) },
    { field: 'aup', headerName: 'АУП', ...n(70) },
    { field: 'lineyka', headerName: 'Линейка', ...n(80) },
    { field: 'other', headerName: 'Прочее', ...n(80) },
    pct('nehvatka', 'Нехватка'),
    pct('ukompl', 'Укомпл.'),
  ]

  const columnGroupingModel = [
    { groupId: 'g1', headerName: 'Общая информация', children: [{ field: 'n' }, { field: 'store' }, { field: 'recruiter' }, { field: 'rm' }, { field: 'dm' }, { field: 'shtat' }] },
    { groupId: 'g2', headerName: 'Трудоустроенность', children: [{ field: 'zup' }, { field: 'neof' }, { field: 'stazh' }, { field: 'itogo' }] },
    { groupId: 'g3', headerName: 'План вакансий', children: [{ field: 'vac' }, { field: 'aup' }, { field: 'lineyka' }, { field: 'other' }] },
    { groupId: 'g4', headerName: '%', children: [{ field: 'nehvatka' }, { field: 'ukompl' }] },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <AssessmentOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Сводный план</Typography>
          <Typography variant="body2" color="text.secondary">Укомплектованность по магазинам · красным — ниже 90%</Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}><Stat label="Штат всего" value={totals.shtat} /></Grid>
        <Grid item xs={6} md={3}><Stat label="Работает" value={totals.itogo} color="primary.main" /></Grid>
        <Grid item xs={6} md={3}><Stat label="Вакансий" value={totals.vac} color="warning.main" /></Grid>
        <Grid item xs={6} md={3}><Stat label="Укомплектованность" value={`${totals.ukompl}%`} color={totals.ukompl < 90 ? 'error.main' : 'success.main'} /></Grid>
      </Grid>

      <Paper sx={{ height: 620 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          columnGroupingModel={columnGroupingModel}
          loading={sLoading || vLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
          slots={{ toolbar: Toolbar }}
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 } }}
        />
      </Paper>
    </Box>
  )
}
