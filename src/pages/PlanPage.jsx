import { useMemo } from 'react'
import { Box, Paper, Typography, Alert, Grid } from '@mui/material'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import {
  DataGrid, GridToolbarContainer, GridToolbarQuickFilter, GridToolbarExport, GridToolbarColumnsButton,
} from '@mui/x-data-grid'
import { useStores } from '../hooks/useStores'
import { useStaffing } from '../hooks/useStaffing'

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
const r1 = (x) => Math.round(x * 10) / 10

const GRP = {
  n: 'g1', store: 'g1', recruiter: 'g1', rm: 'g1', dm: 'g1', shtat: 'g1',
  zup: 'g2', neof: 'g2', stazh: 'g2', itogo: 'g2',
  fakt: 'g3', plan: 'g3', vsego: 'g3',
  nehvatka: 'g4', ukompl: 'g4',
}

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
  const { rows: staffing, planByStore, loading: stLoading } = useStaffing()

  const rows = useMemo(() => {
    const agg = new Map()
    for (const s of staffing) {
      const a = agg.get(s.store_id) ?? { shtat: 0, zup: 0, neof: 0, stazh: 0, fakt: 0 }
      const zup = num(s.zup)
      const work = zup + num(s.neof) + num(s.stazhirovka)
      a.shtat += num(s.shtat); a.zup += zup; a.neof += num(s.neof); a.stazh += num(s.stazhirovka)
      a.fakt += Math.max(num(s.shtat) - work, 0)
      agg.set(s.store_id, a)
    }
    return stores.map((st, i) => {
      const a = agg.get(st.id) ?? { shtat: 0, zup: 0, neof: 0, stazh: 0, fakt: 0 }
      const itogo = a.zup + a.neof + a.stazh
      const plan = planByStore(st.id)
      const ukompl = a.shtat > 0 ? (itogo / a.shtat) * 100 : 0
      return {
        id: st.id, n: i + 1, store: st.name, recruiter: '—',
        rm: st.region?.rm?.name ?? st.region?.name ?? st.region?.code ?? '—',
        dm: st.director?.name ?? st.dm_name ?? '—',
        shtat: r1(a.shtat), zup: r1(a.zup), neof: r1(a.neof), stazh: r1(a.stazh), itogo: r1(itogo),
        fakt: r1(a.fakt), plan: r1(plan), vsego: r1(a.fakt + plan),
        nehvatka: Math.round(100 - ukompl), ukompl: Math.round(ukompl),
      }
    })
  }, [staffing, stores, planByStore])

  const totals = useMemo(() => {
    const shtat = rows.reduce((s, r) => s + r.shtat, 0)
    const itogo = rows.reduce((s, r) => s + r.itogo, 0)
    const vsego = rows.reduce((s, r) => s + r.vsego, 0)
    return { shtat: r1(shtat), itogo: r1(itogo), vsego: r1(vsego), ukompl: shtat > 0 ? Math.round(itogo / shtat * 100) : 0 }
  }, [rows])

  const n = (w = 80) => ({ type: 'number', width: w, headerAlign: 'center', align: 'center' })
  const pct = (field, headerName, colored = true) => ({
    field, headerName, ...n(120),
    renderCell: ({ value }) => {
      if (!colored) return <Typography sx={{ fontSize: '0.8rem' }}>{value}%</Typography>
      const low = value < 90
      return <Typography sx={{ fontSize: '0.8rem', fontWeight: low ? 700 : 400, color: low ? 'error.main' : 'success.main' }}>{value}%</Typography>
    },
  })

  const baseColumns = [
    { field: 'n', headerName: '№', width: 56, headerAlign: 'center', align: 'center' },
    { field: 'store', headerName: 'Магазин', flex: 1, minWidth: 180 },
    { field: 'recruiter', headerName: 'Рекрутер', width: 110 },
    { field: 'rm', headerName: 'РМ', width: 160 },
    { field: 'dm', headerName: 'ДМ', width: 180 },
    { field: 'shtat', headerName: 'ШТАТ', ...n(80) },
    { field: 'zup', headerName: 'ЗУП', ...n(70) },
    { field: 'neof', headerName: 'НЕОФ', ...n(70) },
    { field: 'stazh', headerName: 'СТАЖ', ...n(70) },
    { field: 'itogo', headerName: 'Работает', ...n(90) },
    { field: 'fakt', headerName: 'Факт ваканс.', ...n(110) },
    { field: 'plan', headerName: 'План', ...n(75) },
    { field: 'vsego', headerName: 'Всего ваканс.', ...n(110) },
    pct('nehvatka', 'Нехватка', false),
    pct('ukompl', 'Укомпл.'),
  ]
  const columns = baseColumns.map(c => ({ ...c, headerClassName: `grp-${GRP[c.field]}`, cellClassName: `grp-${GRP[c.field]}` }))

  const columnGroupingModel = [
    { groupId: 'g1', headerName: 'Общая информация', headerClassName: 'grp-g1', children: [{ field: 'n' }, { field: 'store' }, { field: 'recruiter' }, { field: 'rm' }, { field: 'dm' }, { field: 'shtat' }] },
    { groupId: 'g2', headerName: 'Трудоустроенность', headerClassName: 'grp-g2', children: [{ field: 'zup' }, { field: 'neof' }, { field: 'stazh' }, { field: 'itogo' }] },
    { groupId: 'g3', headerName: 'Вакансии', headerClassName: 'grp-g3', children: [{ field: 'fakt' }, { field: 'plan' }, { field: 'vsego' }] },
    { groupId: 'g4', headerName: '%', children: [{ field: 'nehvatka' }, { field: 'ukompl' }] },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <AssessmentOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Сводный план</Typography>
          <Typography variant="body2" color="text.secondary">Укомплектованность по магазинам (из штатного расписания) · красным — ниже 90%</Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}><Stat label="Штат всего" value={totals.shtat} /></Grid>
        <Grid item xs={6} md={3}><Stat label="Работает" value={totals.itogo} color="primary.main" /></Grid>
        <Grid item xs={6} md={3}><Stat label="Всего вакансий" value={totals.vsego} color="warning.main" /></Grid>
        <Grid item xs={6} md={3}><Stat label="Укомплектованность" value={`${totals.ukompl}%`} color={totals.ukompl < 90 ? 'error.main' : 'success.main'} /></Grid>
      </Grid>

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          columnGroupingModel={columnGroupingModel}
          loading={sLoading || stLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
          slots={{ toolbar: Toolbar }}
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
            '& .grp-g1': { backgroundColor: 'rgba(62,207,142,0.07)' },
            '& .grp-g2': { backgroundColor: 'rgba(56,132,255,0.10)' },
            '& .grp-g3': { backgroundColor: 'rgba(251,191,36,0.09)' },
          }}
        />
      </Paper>
    </Box>
  )
}
