import { useMemo, useState, useEffect } from 'react'
import {
  Box, Paper, Typography, Alert, Chip, Snackbar, Button, IconButton, Tooltip,
  FormControl, InputLabel, Select, MenuItem, TextField, Autocomplete,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { DataGrid } from '@mui/x-data-grid'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useStores } from '../hooks/useStores'
import { useStaffing } from '../hooks/useStaffing'

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
const r1 = (x) => Math.round(x * 10) / 10
const normName = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
const VID_OPTIONS = ['супермаркет', 'микс', 'шоурум', 'алкомаркет', 'микс /алкомаркет']

function AddStoreDialog({ regionId, regionLabel, allStores, onClose, onAdded, onError }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [vid, setVid] = useState('супермаркет')
  const [dm, setDm] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const codeT = code.trim(), nameT = name.trim()
    // проверка на существующий магазин по коду И названию
    const dupCode = codeT && allStores.some(s => (s.code ?? '').trim() === codeT)
    const dupName = allStores.some(s => normName(s.name) === normName(nameT))
    if (dupCode) return onError('Магазин с таким кодом уже есть в системе')
    if (dupName) return onError('Магазин с таким названием уже есть в системе')
    setSaving(true)
    const { error } = await supabase.from('stores').insert({
      code: codeT || null, name: nameT, vid: vid || null, region_id: regionId, dm_name: dm.trim() || null,
    })
    setSaving(false)
    if (error) return onError(error.message)
    onAdded()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem' }}>Новый магазин · {regionLabel}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField label="Код" value={code} onChange={e => setCode(e.target.value)} fullWidth sx={{ mt: 1 }} />
        <TextField label="Название" value={name} onChange={e => setName(e.target.value)} required fullWidth />
        <TextField label="Вид" value={vid} onChange={e => setVid(e.target.value)} select fullWidth>
          {VID_OPTIONS.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
        </TextField>
        <TextField label="Директор (ДМ)" value={dm} onChange={e => setDm(e.target.value)} fullWidth />
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">Отмена</Button>
        <Button onClick={save} variant="contained" size="small" disabled={saving || !name.trim()}>Добавить</Button>
      </DialogActions>
    </Dialog>
  )
}

/** Редактирование магазина: название, регион (=РМ), директор (admin) */
function EditStoreDialog({ store, regionOptions, isAdmin, onClose, onSaved, onError }) {
  const [name, setName] = useState(store.name ?? '')
  const [regionId, setRegionId] = useState(store.region_id ?? '')
  const [directors, setDirectors] = useState([])
  const [director, setDirector] = useState(null)
  const [loading, setLoading] = useState(isAdmin)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    supabase.from('profiles').select('id, name, email').eq('role', 'director').order('name')
      .then(({ data }) => {
        if (!active) return
        const list = data ?? []
        setDirectors(list)
        setDirector(list.find(d => d.id === store.director_id) ?? null)
        setLoading(false)
      })
    return () => { active = false }
  }, [isAdmin, store.director_id])

  const save = async () => {
    setSaving(true)
    try {
      const patch = { name: name.trim(), region_id: regionId || null }
      if (isAdmin) {
        patch.director_id = director?.id ?? null
        patch.dm_name = director ? (director.name ?? director.email) : null
      }
      const upd = await supabase.from('stores').update(patch).eq('id', store.id)
      if (upd.error) throw upd.error
      // синхронизация скоупа директора (user_stores) при смене
      if (isAdmin && (director?.id ?? null) !== (store.director_id ?? null)) {
        if (store.director_id) {
          const d = await supabase.from('user_stores').delete().eq('user_id', store.director_id).eq('store_id', store.id)
          if (d.error) throw d.error
        }
        if (director?.id) {
          const i = await supabase.from('user_stores').upsert({ user_id: director.id, store_id: store.id })
          if (i.error) throw i.error
        }
      }
      onSaved()
    } catch (e) {
      onError(e.message ?? 'Ошибка сохранения')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem' }}>Редактировать магазин{store.code ? ` · ${store.code}` : ''}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField label="Название" value={name} onChange={e => setName(e.target.value)} required fullWidth sx={{ mt: 1 }} />
        <TextField label="Регион (РМ)" value={regionId} onChange={e => setRegionId(e.target.value)} select fullWidth helperText="РМ определяется регионом">
          {regionOptions.map(r => <MenuItem key={r.id} value={r.id}>{r.code}{(r.rm?.name ?? r.name) ? ` — ${r.rm?.name ?? r.name}` : ''}</MenuItem>)}
        </TextField>
        {isAdmin && (
          <Autocomplete
            options={directors} value={director} loading={loading}
            onChange={(_, v) => setDirector(v)}
            getOptionLabel={d => d.name || d.email || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={p => <TextField {...p} label="Директор" placeholder="Не назначен" />}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">Отмена</Button>
        <Button onClick={save} variant="contained" size="small" disabled={saving || !name.trim() || !regionId}>Сохранить</Button>
      </DialogActions>
    </Dialog>
  )
}

export default function RmPage() {
  const { role, regionIds } = useAuth()
  const { stores, regions, loading: sLoading, error, refetch } = useStores()
  const { rows: staffing, planByStore, loading: stLoading } = useStaffing()

  // менеджеры (регионы): admin — все; РМ — только свои
  const myRegions = useMemo(
    () => (role === 'admin' ? regions : regions.filter(r => regionIds.includes(r.id))),
    [regions, role, regionIds],
  )
  const [regionId, setRegionId] = useState('')
  useEffect(() => { if (regionId === '' && myRegions.length) setRegionId(myRegions[0].id) }, [myRegions, regionId])

  const canManage = role === 'admin' || role === 'rm'
  const isAdmin = role === 'admin'
  const regionOptions = isAdmin ? regions : myRegions
  const [addOpen, setAddOpen] = useState(false)
  const [editStore, setEditStore] = useState(null)
  const [delStore, setDelStore] = useState(null)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })
  const toast = (message, severity = 'success') => setSnack({ open: true, message, severity })

  const regionStores = useMemo(() => stores.filter(s => s.region_id === regionId), [stores, regionId])
  const selectedRegion = myRegions.find(r => r.id === regionId)

  const agg = useMemo(() => {
    const m = new Map()
    for (const s of staffing) {
      const a = m.get(s.store_id) ?? { shtat: 0, work: 0, fakt: 0 }
      const work = num(s.zup) + num(s.neof) + num(s.stazhirovka)
      a.shtat += num(s.shtat); a.work += work; a.fakt += Math.max(num(s.shtat) - work, 0)
      m.set(s.store_id, a)
    }
    return m
  }, [staffing])

  const gridRows = useMemo(() => regionStores.map(s => {
    const a = agg.get(s.id) ?? { shtat: 0, work: 0, fakt: 0 }
    const ukompl = a.shtat > 0 ? Math.round(a.work / a.shtat * 100) : 0
    return { id: s.id, code: s.code, name: s.name, vid: s.vid, dm_name: s.director?.name ?? s.dm_name, shtat: r1(a.shtat), work: r1(a.work), vsego: r1(a.fakt + planByStore(s.id)), ukompl }
  }), [regionStores, agg, planByStore])

  const handleDelete = async () => {
    const { error } = await supabase.from('stores').delete().eq('id', delStore.id)
    setDelStore(null)
    if (error) return toast(error.message, 'error')
    toast('Магазин удалён')
    refetch()
  }

  const columns = [
    { field: 'code', headerName: 'Код', width: 80 },
    { field: 'name', headerName: 'Магазин', flex: 1, minWidth: 200 },
    { field: 'vid', headerName: 'Вид', width: 140 },
    { field: 'dm_name', headerName: 'Директор', flex: 1, minWidth: 180 },
    { field: 'shtat', headerName: 'Штат', width: 80, type: 'number', headerAlign: 'center', align: 'center' },
    { field: 'work', headerName: 'Работает', width: 95, type: 'number', headerAlign: 'center', align: 'center' },
    { field: 'vsego', headerName: 'Вакансий', width: 95, type: 'number', headerAlign: 'center', align: 'center' },
    {
      field: 'ukompl', headerName: 'Укомпл.', width: 100, type: 'number', headerAlign: 'center', align: 'center',
      renderCell: ({ value }) => <Typography sx={{ fontWeight: value < 90 ? 700 : 400, color: value < 90 ? 'error.main' : 'success.main' }}>{value}%</Typography>,
    },
    ...(canManage ? [{
      field: '__act', headerName: '', width: 86, sortable: false, filterable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex' }}>
          <Tooltip title="Редактировать">
            <IconButton size="small" onClick={() => setEditStore(stores.find(s => s.id === row.id))} sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
              <EditOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Удалить магазин">
            <IconButton size="small" onClick={() => setDelStore(row)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    }] : []),
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <MapOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Региональный менеджер</Typography>
          <Typography variant="body2" color="text.secondary">Магазины региона · добавление и удаление</Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 300 }}>
          <InputLabel>Менеджер (регион)</InputLabel>
          <Select value={regionId} label="Менеджер (регион)" onChange={e => setRegionId(e.target.value)} disabled={sLoading || myRegions.length <= 1 && role !== 'admin'}>
            {myRegions.map(r => { const nm = r.rm?.name ?? r.name; return <MenuItem key={r.id} value={r.id}>{r.code}{nm ? ` — ${nm}` : ''}</MenuItem> })}
          </Select>
        </FormControl>
        <Chip size="small" label={`магазинов: ${regionStores.length}`} />
        <Box sx={{ flex: 1 }} />
        {canManage && regionId && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Магазин</Button>
        )}
      </Paper>

      <Paper sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={gridRows}
          columns={columns}
          loading={sLoading || stLoading}
          disableRowSelectionOnClick
          sx={{ border: 'none' }}
        />
      </Paper>

      {addOpen && (
        <AddStoreDialog
          regionId={regionId}
          regionLabel={selectedRegion ? `${selectedRegion.code}${(selectedRegion.rm?.name ?? selectedRegion.name) ? ' — ' + (selectedRegion.rm?.name ?? selectedRegion.name) : ''}` : ''}
          allStores={stores}
          onClose={() => setAddOpen(false)}
          onError={(m) => toast(m, 'error')}
          onAdded={() => { setAddOpen(false); toast('Магазин добавлен'); refetch() }}
        />
      )}

      {editStore && (
        <EditStoreDialog
          store={editStore}
          regionOptions={regionOptions}
          isAdmin={isAdmin}
          onClose={() => setEditStore(null)}
          onError={(m) => toast(m, 'error')}
          onSaved={() => { setEditStore(null); toast('Магазин обновлён'); refetch() }}
        />
      )}

      <Dialog open={!!delStore} onClose={() => setDelStore(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem' }}>Удалить магазин?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            «{delStore?.name}» будет удалён вместе со штатным расписанием и вакансиями этого магазина. Действие необратимо.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setDelStore(null)} variant="outlined" size="small">Отмена</Button>
          <Button onClick={handleDelete} variant="contained" color="error" size="small">Удалить</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ fontSize: '0.8rem' }} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  )
}
