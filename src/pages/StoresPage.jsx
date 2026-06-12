import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem, Chip, Alert, Snackbar,
} from '@mui/material'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { DataGrid, GridToolbarContainer, GridToolbarQuickFilter } from '@mui/x-data-grid'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useStores } from '../hooks/useStores'

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : Number(x) || 0)
const normName = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

export default function StoresPage() {
  const { role, storeIds, regionIds } = useAuth()
  const { stores, loading: storesLoading } = useStores()
  const editable = ['admin', 'hr', 'director'].includes(role)

  const myStores = useMemo(() => {
    if (role === 'admin' || role === 'hr') return stores
    if (role === 'director') return stores.filter(s => storeIds.includes(s.id))
    if (role === 'rm') return stores.filter(s => regionIds.includes(s.region_id))
    return []
  }, [stores, role, storeIds, regionIds])

  const [storeId, setStoreId] = useState('')
  useEffect(() => { if (storeId === '' && myStores.length) setStoreId(myStores[0].id) }, [myStores, storeId])

  const [staffing, setStaffing] = useState([])
  const [vacancies, setVacancies] = useState([])
  const [loading, setLoading] = useState(false)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })
  const toast = (message, severity = 'success') => setSnack({ open: true, message, severity })

  const loadCard = useCallback(async (id) => {
    if (!id) { setStaffing([]); setVacancies([]); return }
    setLoading(true)
    const [s, v] = await Promise.all([
      supabase.from('staffing').select('*').eq('store_id', id).order('position'),
      supabase.from('vacancies').select('*').eq('store_id', id),
    ])
    setStaffing(s.data ?? [])
    setVacancies(v.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadCard(storeId) }, [storeId, loadCard])

  const rows = useMemo(() => {
    const vByPos = new Map(vacancies.map(v => [normName(v.vacancy_type), v]))
    return staffing.map((s, i) => {
      const vac = vByPos.get(normName(s.position))
      const zup = num(s.zup), neof = num(s.neof), stazh = num(s.stazhirovka)
      const vsego = zup + neof + stazh
      const fakt = Math.max(num(s.shtat) - vsego, 0)
      const plan = num(vac?.qty)
      return {
        id: s.id, n: i + 1, store_id: s.store_id, position: s.position, category: s.category,
        shtat: num(s.shtat), zup, neof, stazhirovka: stazh, vsego, fakt,
        plan, opened_date: vac?.opened_date ?? '', reason: vac?.reason ?? '',
        vacancies_total: fakt + plan, vacancy_id: vac?.id ?? null,
      }
    })
  }, [staffing, vacancies])

  const processRowUpdate = async (newRow, oldRow) => {
    try {
      // НЕОФ / Стажировка → staffing
      if (Number(newRow.neof) !== Number(oldRow.neof) || Number(newRow.stazhirovka) !== Number(oldRow.stazhirovka)) {
        const { error } = await supabase.from('staffing')
          .update({ neof: Number(newRow.neof) || 0, stazhirovka: Number(newRow.stazhirovka) || 0 })
          .eq('id', newRow.id)
        if (error) throw error
      }
      // ПЛАН / ДАТА / ПРИЧИНЫ → vacancies (upsert по store+тип, тип = должность)
      if (newRow.plan !== oldRow.plan || newRow.opened_date !== oldRow.opened_date || newRow.reason !== oldRow.reason) {
        const plan = Number(newRow.plan) || 0
        const hasData = plan > 0 || newRow.opened_date || newRow.reason
        if (!hasData && newRow.vacancy_id) {
          const { error } = await supabase.from('vacancies').delete().eq('id', newRow.vacancy_id)
          if (error) throw error
        } else if (hasData) {
          const { error } = await supabase.from('vacancies').upsert(
            { store_id: newRow.store_id, vacancy_type: newRow.position, qty: plan, opened_date: newRow.opened_date || null, reason: newRow.reason || null },
            { onConflict: 'store_id,vacancy_type' },
          )
          if (error) throw error
        }
      }
      toast('Сохранено')
      await loadCard(storeId)
      const vsego = num(newRow.zup) + (Number(newRow.neof) || 0) + (Number(newRow.stazhirovka) || 0)
      const fakt = Math.max(num(newRow.shtat) - vsego, 0)
      return { ...newRow, vsego, fakt, vacancies_total: fakt + (Number(newRow.plan) || 0) }
    } catch (err) {
      toast(err.message ?? 'Ошибка', 'error')
      throw err
    }
  }

  const currentStore = myStores.find(s => s.id === storeId)
  const ne = (w) => ({ type: 'number', width: w, headerAlign: 'center', align: 'center' })
  const ed = (w) => ({ ...ne(w), editable })

  const columns = [
    { field: 'n', headerName: '№', width: 54, headerAlign: 'center', align: 'center' },
    { field: 'position', headerName: 'Должность', flex: 1, minWidth: 180 },
    { field: 'category', headerName: 'Категория', width: 110 },
    { field: 'shtat', headerName: 'Штат', ...ne(70) },
    { field: 'zup', headerName: 'ЗУП', ...ne(70), description: 'Из отчёта' },
    { field: 'neof', headerName: 'НЕОФ', ...ed(80) },
    { field: 'stazhirovka', headerName: 'СТАЖ', ...ed(80) },
    { field: 'vsego', headerName: 'ВСЕГО', ...ne(80), description: 'ЗУП+НЕОФ+СТАЖ' },
    { field: 'fakt', headerName: 'Факт ваканс.', ...ne(110), description: 'Штат−ВСЕГО' },
    { field: 'plan', headerName: 'План', ...ed(75) },
    { field: 'opened_date', headerName: 'Дата начала', width: 120, editable },
    { field: 'reason', headerName: 'Причины', flex: 1, minWidth: 160, editable },
    { field: 'vacancies_total', headerName: 'Вакансий', ...ne(95), description: 'Факт+План' },
  ]

  const GRP = { n: 'a', position: 'a', category: 'a', shtat: 'a', zup: 'a', neof: 'b', stazhirovka: 'b', vsego: 'b', fakt: 'c', plan: 'c', opened_date: 'c', reason: 'c', vacancies_total: 'c' }
  const cols = columns.map(c => ({ ...c, cellClassName: `g-${GRP[c.field]}`, headerClassName: `g-${GRP[c.field]}` }))

  const Toolbar = () => (
    <GridToolbarContainer sx={{ justifyContent: 'flex-end', p: 1 }}>
      <GridToolbarQuickFilter debounceMs={300} />
    </GridToolbarContainer>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <StorefrontOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Магазины · Карточка</Typography>
          <Typography variant="body2" color="text.secondary">
            {editable ? 'Правьте НЕОФ/Стаж и План/Дату/Причины (двойной клик)' : 'Просмотр'} · доступно магазинов: {myStores.length}
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>Магазин</InputLabel>
          <Select value={storeId} label="Магазин" onChange={e => setStoreId(e.target.value)} disabled={storesLoading}>
            {myStores.map(s => <MenuItem key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ''}{s.name}</MenuItem>)}
          </Select>
        </FormControl>
        {currentStore && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {currentStore.vid && <Chip size="small" label={currentStore.vid} />}
            {currentStore.region?.code && <Chip size="small" color="primary" label={currentStore.region.code} />}
            {(currentStore.director?.name || currentStore.dm_name) && <Chip size="small" variant="outlined" label={`ДМ: ${currentStore.director?.name ?? currentStore.dm_name}`} />}
          </Box>
        )}
      </Paper>

      <Paper sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={rows}
          columns={cols}
          loading={loading || storesLoading}
          processRowUpdate={editable ? processRowUpdate : undefined}
          onProcessRowUpdateError={(err) => toast(err.message, 'error')}
          autoPageSize
          disableRowSelectionOnClick
          slots={{ toolbar: Toolbar }}
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
            '& .g-a': { backgroundColor: 'rgba(62,207,142,0.06)' },
            '& .g-b': { backgroundColor: 'rgba(56,132,255,0.09)' },
            '& .g-c': { backgroundColor: 'rgba(251,191,36,0.08)' },
            '& .MuiDataGrid-cell--editable': { color: 'primary.main' },
          }}
        />
      </Paper>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ fontSize: '0.8rem' }} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  )
}
