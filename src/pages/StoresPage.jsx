import { useState, useMemo, useEffect } from 'react'
import {
  Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  Chip, Alert, Snackbar, Button, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete,
} from '@mui/material'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { DataGrid } from '@mui/x-data-grid'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/rbac'
import { useStores } from '../hooks/useStores'
import { useVacancies } from '../hooks/useVacancies'

function AddDialog({ positions, onClose, onAdd }) {
  const [type, setType] = useState('')
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try { await onAdd({ vacancy_type: type.trim(), qty: Number(qty) || 1 }); onClose() }
    catch { setSaving(false) }
  }
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem' }}>Новая вакансия</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Autocomplete
          freeSolo options={positions} value={type}
          onChange={(_, v) => setType(v ?? '')} onInputChange={(_, v) => setType(v)}
          renderInput={p => <TextField {...p} label="Тип вакансии (должность)" sx={{ mt: 1 }} />}
        />
        <TextField label="Количество" type="number" value={qty} onChange={e => setQty(e.target.value)} inputProps={{ min: 1 }} fullWidth />
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">Отмена</Button>
        <Button onClick={save} variant="contained" size="small" disabled={saving || !type.trim()}>Добавить</Button>
      </DialogActions>
    </Dialog>
  )
}

export default function StoresPage() {
  const { role, storeIds, regionIds } = useAuth()
  const { stores, loading: storesLoading } = useStores()
  const editable = can(role, 'canEditVacancies') || role === 'hr'

  const myStores = useMemo(() => {
    if (role === 'admin' || role === 'hr') return stores
    if (role === 'director') return stores.filter(s => storeIds.includes(s.id))
    if (role === 'rm') return stores.filter(s => regionIds.includes(s.region_id))
    return []
  }, [stores, role, storeIds, regionIds])

  const [storeId, setStoreId] = useState('')
  useEffect(() => { if (storeId === '' && myStores.length) setStoreId(myStores[0].id) }, [myStores, storeId])

  const { rows, loading, error, clearError, add, remove, processRowUpdate } = useVacancies({ storeId: storeId || undefined })
  const [positions, setPositions] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })
  const toast = (message, severity = 'success') => setSnack({ open: true, message, severity })

  // варианты типов вакансий = должности из штатного расписания этого магазина
  useEffect(() => {
    if (!storeId) { setPositions([]); return }
    let active = true
    supabase.from('staffing').select('position').eq('store_id', storeId).then(({ data }) => {
      if (!active) return
      setPositions([...new Set((data ?? []).map(r => r.position))].sort())
    })
    return () => { active = false }
  }, [storeId])

  const currentStore = myStores.find(s => s.id === storeId)

  const handleRowUpdate = async (newRow, oldRow) => {
    try { const u = await processRowUpdate(newRow, oldRow); toast('Сохранено'); return u }
    catch (err) { toast(err.message ?? 'Ошибка', 'error'); throw err }
  }
  const handleDelete = async (id) => {
    try { await remove(id); toast('Удалено') } catch (err) { toast(err.message, 'error') }
  }

  const columns = [
    { field: 'vacancy_type', headerName: 'Тип вакансии (должность)', flex: 1, minWidth: 240, editable },
    { field: 'qty', headerName: 'Количество', width: 140, type: 'number', editable },
    ...(editable ? [{
      field: '__act', headerName: '', width: 50, sortable: false, filterable: false,
      renderCell: ({ row }) => (
        <Tooltip title="Удалить">
          <IconButton size="small" onClick={() => handleDelete(row.id)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      ),
    }] : []),
  ]

  const totalQty = rows.reduce((s, r) => s + (r.qty || 0), 0)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <StorefrontOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Магазины · Вакансии</Typography>
          <Typography variant="body2" color="text.secondary">
            Тип вакансии и количество · доступно магазинов: {myStores.length} · заявлено вакансий: {totalQty}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>{error}</Alert>}

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
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        {editable && storeId && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Вакансия</Button>
        )}
      </Paper>

      <Paper sx={{ height: 520 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading || storesLoading}
          processRowUpdate={editable ? handleRowUpdate : undefined}
          onProcessRowUpdateError={(err) => toast(err.message, 'error')}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          sx={{ border: 'none' }}
        />
      </Paper>

      {addOpen && (
        <AddDialog
          positions={positions}
          onClose={() => setAddOpen(false)}
          onAdd={async (v) => {
            try { await add({ store_id: storeId, ...v }); toast('Вакансия добавлена') }
            catch (e) { toast(e.message?.includes('duplicate') ? 'Такой тип вакансии уже есть' : e.message, 'error'); throw e }
          }}
        />
      )}

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ fontSize: '0.8rem' }} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  )
}
