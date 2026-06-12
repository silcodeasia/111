import { useMemo, useState, useRef } from 'react'
import {
  Box, Paper, Typography, Alert, Snackbar, Button, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete, MenuItem,
} from '@mui/material'
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { DataGrid, GridToolbarContainer, GridToolbarQuickFilter, GridToolbarExport } from '@mui/x-data-grid'
import { useStaffing } from '../hooks/useStaffing'
import { useStores } from '../hooks/useStores'

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
const normName = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
const CATEGORIES = ['АУП', 'Линейка', 'Грузчики', 'Допек']

function AddDialog({ stores, onClose, onAdd }) {
  const [store, setStore] = useState(null)
  const [position, setPosition] = useState('')
  const [category, setCategory] = useState('Линейка')
  const [shtat, setShtat] = useState('1')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try { await onAdd({ store_id: store.id, position: position.trim(), category, shtat: Number(shtat) || 0 }); onClose() }
    finally { setSaving(false) }
  }
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem' }}>Новая строка штатного расписания</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Autocomplete
          options={stores} value={store} onChange={(_, v) => setStore(v)}
          getOptionLabel={s => `${s.code ? s.code + ' · ' : ''}${s.name}`}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          renderInput={p => <TextField {...p} label="Магазин" sx={{ mt: 1 }} />}
        />
        <TextField label="Должность" value={position} onChange={e => setPosition(e.target.value)} fullWidth />
        <TextField label="Категория" value={category} onChange={e => setCategory(e.target.value)} select fullWidth>
          {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <TextField label="Штат (ставок)" type="number" value={shtat} onChange={e => setShtat(e.target.value)} fullWidth />
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">Отмена</Button>
        <Button onClick={save} variant="contained" size="small" disabled={saving || !store || !position.trim()}>Добавить</Button>
      </DialogActions>
    </Dialog>
  )
}

export default function StaffingPage() {
  const { rows, zupOf, loading, error, clearError, processRowUpdate, add, remove, replaceReport } = useStaffing()
  const { stores } = useStores()
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })
  const [addOpen, setAddOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const toast = (message, severity = 'success') => setSnack({ open: true, message, severity })

  const storeByNorm = useMemo(() => {
    const m = new Map()
    for (const s of stores) m.set(normName(s.name), s)
    return m
  }, [stores])

  const gridRows = useMemo(() => rows.map(s => {
    const zup = zupOf(s.store_id, s.position)
    const rabotaet = zup + num(s.neof) + num(s.stazhirovka)
    const fakt = Math.max(num(s.shtat) - rabotaet, 0)
    const vsego = fakt + num(s.plan)
    return { ...s, storeName: s.store?.name ?? '—', zup, rabotaet, fakt, vsego }
  }), [rows, zupOf])

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false })
      const sheet = wb.SheetNames.find(n => /отч[её]т/i.test(n)) ?? wb.SheetNames[0]
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null, blankrows: false })
      const header = aoa[0] || []
      const col = (re) => header.findIndex(h => re.test(String(h ?? '')))
      const ciPod = col(/подразделени/i), ciDol = col(/должност/i), ciPop = col(/попадани/i)
      if (ciPod < 0 || ciDol < 0 || ciPop < 0)
        throw new Error('Не найдены столбцы «Подразделение» / «Должность» / «Попадание в отчёт»')
      let unmatched = 0
      const records = []
      for (const r of aoa.slice(1)) {
        if (Number(r[ciPop]) !== 1) continue
        const dol = r[ciDol]
        if (!dol || String(dol).trim() === '') continue
        const pod = r[ciPod]
        const store = storeByNorm.get(normName(pod))
        if (!store) unmatched++
        records.push({ store_id: store?.id ?? null, podrazdelenie: pod ?? null, dolzhnost: String(dol).trim() })
      }
      await replaceReport(records)
      toast(`Отчёт загружен: ${records.length} строк${unmatched ? `, без магазина: ${unmatched}` : ''}`)
    } catch (err) {
      toast(err.message ?? 'Ошибка загрузки', 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleRowUpdate = async (newRow, oldRow) => {
    try { const u = await processRowUpdate(newRow, oldRow); toast('Сохранено'); return u }
    catch (err) { toast(err.message ?? 'Ошибка', 'error'); throw err }
  }

  const handleDelete = async (id) => {
    try { await remove(id); toast('Удалено') } catch (err) { toast(err.message, 'error') }
  }

  const e = true // editable (страница только для admin/HR)
  const n = (w, edit) => ({ type: 'number', width: w, headerAlign: 'center', align: 'center', editable: !!edit })

  const columns = [
    { field: 'storeName', headerName: 'Подразделение', width: 180 },
    { field: 'position', headerName: 'Должность', flex: 1, minWidth: 180, editable: e },
    { field: 'category', headerName: 'Категория', width: 120, editable: e, type: 'singleSelect', valueOptions: CATEGORIES },
    { field: 'shtat', headerName: 'Штат', ...n(80, e) },
    { field: 'zup', headerName: 'ЗУП', ...n(70), description: 'Из отчёта (count по магазину+должности)' },
    { field: 'neof', headerName: 'НЕОФ', ...n(75, e) },
    { field: 'stazhirovka', headerName: 'Стаж', ...n(75, e) },
    { field: 'rabotaet', headerName: 'Работает', ...n(90), description: 'ЗУП+НЕОФ+Стаж' },
    { field: 'fakt', headerName: 'Факт ваканс.', ...n(110), description: 'Штат−Работает' },
    { field: 'plan', headerName: 'План', ...n(75, e) },
    { field: 'opened_date', headerName: 'Дата открытия', width: 130, editable: e },
    { field: 'vsego', headerName: 'Всего ваканс.', ...n(110), description: 'Факт+План' },
    {
      field: '__act', headerName: '', width: 50, sortable: false, filterable: false,
      renderCell: ({ row }) => (
        <Tooltip title="Удалить">
          <IconButton size="small" onClick={() => handleDelete(row.id)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      ),
    },
  ]

  const columnGroupingModel = [
    { groupId: 'base', headerName: 'Штатное расписание', children: [{ field: 'storeName' }, { field: 'position' }, { field: 'category' }, { field: 'shtat' }] },
    { groupId: 'emp', headerName: 'Трудоустроенность', children: [{ field: 'zup' }, { field: 'neof' }, { field: 'stazhirovka' }, { field: 'rabotaet' }] },
    { groupId: 'vac', headerName: 'Вакансии', children: [{ field: 'fakt' }, { field: 'plan' }, { field: 'opened_date' }, { field: 'vsego' }] },
  ]

  const Toolbar = () => (
    <GridToolbarContainer sx={{ justifyContent: 'space-between', p: 1, flexWrap: 'wrap', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Строка</Button>
        <Button size="small" startIcon={<UploadFileOutlinedIcon />} onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Загрузка…' : 'Загрузить отчёт'}
        </Button>
        <GridToolbarExport csvOptions={{ fileName: 'staffing', utf8WithBom: true }} />
      </Box>
      <GridToolbarQuickFilter debounceMs={300} />
    </GridToolbarContainer>
  )

  return (
    <Box>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={ev => handleUpload(ev.target.files?.[0])} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <ListAltOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Штатное расписание</Typography>
          <Typography variant="body2" color="text.secondary">
            ЗУП считается из загруженного отчёта · Работает=ЗУП+НЕОФ+Стаж · Факт=Штат−Работает · Всего=Факт+План
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>{error}</Alert>}
      {rows.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Таблица пуста. Добавьте строки кнопкой «Строка» и загрузите «Отчёт» (xlsx), чтобы заполнить ЗУП.
        </Alert>
      )}

      <Paper sx={{ height: 620 }}>
        <DataGrid
          rows={gridRows}
          columns={columns}
          columnGroupingModel={columnGroupingModel}
          loading={loading}
          processRowUpdate={handleRowUpdate}
          onProcessRowUpdateError={(err) => toast(err.message, 'error')}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
          slots={{ toolbar: Toolbar }}
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 } }}
        />
      </Paper>

      {addOpen && <AddDialog stores={stores} onClose={() => setAddOpen(false)} onAdd={async (v) => { await add(v); toast('Строка добавлена') }} />}

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ fontSize: '0.8rem' }} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  )
}
