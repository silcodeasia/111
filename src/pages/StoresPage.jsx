import { useState, useMemo, useEffect } from 'react'
import {
  Box, Paper, Typography, FormControl, InputLabel, Select, MenuItem,
  Chip, Alert, Snackbar,
} from '@mui/material'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { DataGrid } from '@mui/x-data-grid'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/rbac'
import { useStores } from '../hooks/useStores'
import { useVacancies } from '../hooks/useVacancies'
import { vacancyColumns } from '../lib/vacancyColumns'

export default function StoresPage() {
  const { role, storeIds, regionIds } = useAuth()
  const { stores, loading: storesLoading } = useStores()
  const editable = can(role, 'canEditVacancies')

  // магазины в скоупе пользователя
  const myStores = useMemo(() => {
    if (role === 'admin' || role === 'hr') return stores
    if (role === 'director') return stores.filter(s => storeIds.includes(s.id))
    if (role === 'rm') return stores.filter(s => regionIds.includes(s.region_id))
    return []
  }, [stores, role, storeIds, regionIds])

  const [storeId, setStoreId] = useState('')
  useEffect(() => {
    if (storeId === '' && myStores.length) setStoreId(myStores[0].id)
  }, [myStores, storeId])

  const { rows, loading, error, clearError, processRowUpdate } = useVacancies({ storeId: storeId || undefined })
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })
  const toast = (message, severity = 'success') => setSnack({ open: true, message, severity })

  const columns = useMemo(() => vacancyColumns(editable), [editable])
  const currentStore = myStores.find(s => s.id === storeId)

  const handleRowUpdate = async (newRow, oldRow) => {
    try {
      const updated = await processRowUpdate(newRow, oldRow)
      toast('Сохранено')
      return updated
    } catch (err) {
      toast(err.message ?? 'Ошибка сохранения', 'error')
      throw err
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <StorefrontOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Магазины · Вакансии</Typography>
          <Typography variant="body2" color="text.secondary">
            {editable ? 'Двойной клик по ячейке — редактирование' : 'Просмотр'} · доступно магазинов: {myStores.length}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>Магазин</InputLabel>
          <Select value={storeId} label="Магазин" onChange={e => setStoreId(e.target.value)} disabled={storesLoading}>
            {myStores.map(s => (
              <MenuItem key={s.id} value={s.id}>
                {s.code ? `${s.code} · ` : ''}{s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {currentStore && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {currentStore.vid && <Chip size="small" label={currentStore.vid} />}
            {currentStore.region?.code && <Chip size="small" color="primary" label={currentStore.region.code} />}
            {currentStore.dm_name && <Chip size="small" variant="outlined" label={`ДМ: ${currentStore.dm_name}`} />}
          </Box>
        )}
      </Paper>

      <Paper sx={{ height: 560 }}>
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

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} sx={{ fontSize: '0.8rem' }} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
