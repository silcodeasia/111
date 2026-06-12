import { useMemo, useState, useEffect, useCallback } from 'react'
import { Box, Paper, Typography, Alert, Grid } from '@mui/material'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import {
  DataGrid, GridToolbarContainer, GridToolbarQuickFilter, GridToolbarExport, GridToolbarColumnsButton,
  useGridApiRef, gridFilteredSortedRowEntriesSelector,
} from '@mui/x-data-grid'
import { useStores } from '../hooks/useStores'
import { useStaffing } from '../hooks/useStaffing'

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
const r1 = (x) => Math.round(x * 10) / 10

const GRP = {
  n: 'g1', store: 'g1', recruiter: 'g1', rm: 'g1', dm: 'g1', shtat: 'g1',
  zup: 'g2', neof: 'g2', stazh: 'g2', itogo: 'g2',
  fakt: 'g3', aup: 'g3', gruzchiki: 'g3', dopek: 'g3', lineyka: 'g3',
  nehvatka: 'g4', ukompl: 'g4',
}

// фоновые тинты под цвета групп столбцов
const TINT = { g1: 'rgba(62,207,142,0.10)', g2: 'rgba(56,132,255,0.13)', g3: 'rgba(251,191,36,0.12)' }

function Stat({ label, value, color, bg }) {
  return (
    <Paper sx={{ p: 1.25, bgcolor: bg ?? 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
      <Typography sx={{ fontSize: '0.64rem', fontFamily: 'monospace', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{label}</Typography>
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.2, color: color ?? 'text.primary' }}>{value}</Typography>
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
  const { rows: staffing, loading: stLoading } = useStaffing()

  const rows = useMemo(() => {
    const empty = () => ({ shtat: 0, zup: 0, neof: 0, stazh: 0, fakt: 0, aup: 0, gruzchiki: 0, dopek: 0, lineyka: 0 })
    const agg = new Map()
    for (const s of staffing) {
      const a = agg.get(s.store_id) ?? empty()
      const zup = num(s.zup)
      const work = zup + num(s.neof) + num(s.stazhirovka)
      const faktRow = Math.max(num(s.shtat) - work, 0)
      a.shtat += num(s.shtat); a.zup += zup; a.neof += num(s.neof); a.stazh += num(s.stazhirovka); a.fakt += faktRow
      const c = (s.category || '').toLowerCase()
      if (c.includes('ауп')) a.aup += faktRow
      else if (c.includes('грузч')) a.gruzchiki += faktRow
      else if (c.includes('допек') || c.includes('пекарн')) a.dopek += faktRow
      else if (c.includes('линейк')) a.lineyka += faktRow
      agg.set(s.store_id, a)
    }
    return stores.map((st, i) => {
      const a = agg.get(st.id) ?? empty()
      const itogo = a.zup + a.neof + a.stazh
      const ukompl = a.shtat > 0 ? (itogo / a.shtat) * 100 : 0
      return {
        id: st.id, n: i + 1, store: st.name, recruiter: '—',
        rm: st.region?.rm?.name ?? st.region?.name ?? st.region?.code ?? '—',
        dm: st.director?.name ?? st.dm_name ?? '—',
        shtat: r1(a.shtat), zup: r1(a.zup), neof: r1(a.neof), stazh: r1(a.stazh), itogo: r1(itogo),
        fakt: r1(a.fakt), aup: r1(a.aup), gruzchiki: r1(a.gruzchiki), dopek: r1(a.dopek), lineyka: r1(a.lineyka),
        nehvatka: Math.round(100 - ukompl), ukompl: Math.round(ukompl),
      }
    })
  }, [staffing, stores])

  // Отфильтрованные строки грида → виджеты пересчитываются по фильтру
  const apiRef = useGridApiRef()
  const [view, setView] = useState([])
  useEffect(() => { setView(rows) }, [rows])
  const syncView = useCallback(() => {
    try { setView(gridFilteredSortedRowEntriesSelector(apiRef).map(e => e.model)) } catch { /* грид ещё не готов */ }
  }, [apiRef])

  // Итоги (строка 54 «Сводной») по отфильтрованным магазинам
  const totals = useMemo(() => {
    const ids = new Set(view.map(r => r.id))
    const T = { shtat: 0, zup: 0, neof: 0, stazh: 0, fakt: 0, aup: 0, gruzchiki: 0, dopek: 0, lineyka: 0 }
    const perStore = new Map()
    for (const s of staffing) {
      if (!ids.has(s.store_id)) continue
      const zup = num(s.zup), neof = num(s.neof), stazh = num(s.stazhirovka), shtat = num(s.shtat)
      const work = zup + neof + stazh
      const fakt = Math.max(shtat - work, 0)
      T.shtat += shtat; T.zup += zup; T.neof += neof; T.stazh += stazh; T.fakt += fakt
      const c = (s.category || '').toLowerCase()
      if (c.includes('ауп')) T.aup += fakt
      else if (c.includes('грузч')) T.gruzchiki += fakt
      else if (c.includes('допек') || c.includes('пекарн')) T.dopek += fakt
      else if (c.includes('линейк')) T.lineyka += fakt
      const ps = perStore.get(s.store_id) ?? { shtat: 0, work: 0 }
      ps.shtat += shtat; ps.work += work; perStore.set(s.store_id, ps)
    }
    let sumU = 0, cnt = 0
    for (const ps of perStore.values()) if (ps.shtat > 0) { sumU += ps.work / ps.shtat; cnt++ }
    const ukompl = cnt ? sumU / cnt * 100 : 0
    return {
      shtat: r1(T.shtat), rabotaet: r1(T.zup + T.neof + T.stazh),
      zup: r1(T.zup), neof: r1(T.neof), stazh: r1(T.stazh), fakt: r1(T.fakt),
      aup: r1(T.aup), gruzchiki: r1(T.gruzchiki), dopek: r1(T.dopek), lineyka: r1(T.lineyka),
      ukompl: Math.round(ukompl), nehvatka: Math.round(100 - ukompl), nStores: cnt,
    }
  }, [view, staffing])

  const n = (w = 80) => ({ type: 'number', width: w, headerAlign: 'center', align: 'center' })
  const pct = (field, headerName, colored = true) => ({
    field, headerName, ...n(120),
    renderCell: ({ value }) => {
      const tsx = colored
        ? { fontSize: '0.8rem', fontWeight: value < 90 ? 700 : 400, color: value < 90 ? 'error.main' : 'success.main' }
        : { fontSize: '0.8rem' }
      return (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={tsx}>{value}%</Typography>
        </Box>
      )
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
    { field: 'fakt', headerName: 'Вакансий', ...n(95) },
    { field: 'aup', headerName: 'АУП', ...n(70) },
    { field: 'gruzchiki', headerName: 'Грузчики', ...n(85) },
    { field: 'dopek', headerName: 'Допек', ...n(75) },
    { field: 'lineyka', headerName: 'Линейка', ...n(85) },
    pct('nehvatka', 'Нехватка', false),
    pct('ukompl', 'Укомпл.'),
  ]
  const columns = baseColumns.map(c => ({ ...c, headerClassName: `grp-${GRP[c.field]}`, cellClassName: `grp-${GRP[c.field]}` }))

  const columnGroupingModel = [
    { groupId: 'g1', headerName: 'Общая информация', headerClassName: 'grp-g1', children: [{ field: 'n' }, { field: 'store' }, { field: 'recruiter' }, { field: 'rm' }, { field: 'dm' }, { field: 'shtat' }] },
    { groupId: 'g2', headerName: 'Трудоустроенность', headerClassName: 'grp-g2', children: [{ field: 'zup' }, { field: 'neof' }, { field: 'stazh' }, { field: 'itogo' }] },
    { groupId: 'g3', headerName: 'План вакансий', headerClassName: 'grp-g3', children: [{ field: 'fakt' }, { field: 'aup' }, { field: 'gruzchiki' }, { field: 'dopek' }, { field: 'lineyka' }] },
    { groupId: 'g4', headerName: '%', children: [{ field: 'nehvatka' }, { field: 'ukompl' }] },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <AssessmentOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Сводный план</Typography>
          <Typography variant="body2" color="text.secondary">
            Итоги по {totals.nStores} магазин{totals.nStores % 10 === 1 && totals.nStores % 100 !== 11 ? 'у' : 'ам'} · пересчитываются по фильтру таблицы
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={4} sm={3} md={2}><Stat label="Штат" value={totals.shtat} bg={TINT.g1} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="ЗУП" value={totals.zup} bg={TINT.g2} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="НЕОФ" value={totals.neof} bg={TINT.g2} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="СТАЖ" value={totals.stazh} bg={TINT.g2} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="Работает" value={totals.rabotaet} bg={TINT.g2} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="Вакансий" value={totals.fakt} bg={TINT.g3} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="АУП" value={totals.aup} bg={TINT.g3} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="Грузчики" value={totals.gruzchiki} bg={TINT.g3} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="Допек" value={totals.dopek} bg={TINT.g3} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="Линейка" value={totals.lineyka} bg={TINT.g3} /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="Нехватка" value={`${totals.nehvatka}%`} color="error.main" /></Grid>
        <Grid item xs={4} sm={3} md={2}><Stat label="Укомпл." value={`${totals.ukompl}%`} color={totals.ukompl < 90 ? 'error.main' : 'success.main'} /></Grid>
      </Grid>

      <Paper sx={{ height: 600 }}>
        <DataGrid
          apiRef={apiRef}
          onStateChange={syncView}
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
