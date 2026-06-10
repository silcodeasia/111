import { useState, useMemo } from 'react'
import { Box, Paper, Typography, Alert, Snackbar, Grid } from '@mui/material'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import { DataGrid, GridToolbarContainer, GridToolbarQuickFilter, GridToolbarExport, GridToolbarFilterButton } from '@mui/x-data-grid'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/rbac'
import { useVacancies } from '../hooks/useVacancies'
import { vacancyColumns } from '../lib/vacancyColumns'

function Stat({ label, value, color }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" sx={{ color: color ?? 'text.primary' }}>{value}</Typography>
    </Paper>
  )
}

function Toolbar() {
  return (
    <GridToolbarContainer sx={{ justifyContent: 'space-between', p: 1 }}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <GridToolbarFilterButton />
        <GridToolbarExport csvOptions={{ fileName: 'plan_vacancies', utf8WithBom: true }} />
      </Box>
      <GridToolbarQuickFilter debounceMs={300} />
    </GridToolbarContainer>
  )
}

export default function PlanPage() {
  const { role } = useAuth()
  const editable = can(role, 'canViewPlan') // admin → редактирует свод
  const { rows, loading, error, clearError, processRowUpdate } = useVacancies()
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })
  const toast = (message, severity = 'success') => setSnack({ open: true, message, severity })

  const columns = useMemo(() => ([
    {
      field: 'store', headerName: 'Магазин', width: 200,
      valueGetter: (value, row) => row.store?.name ?? '—',
      sortable: true,
    },
    ...vacancyColumns(editable),
  ]), [editable])

  const stats = useMemo(() => {
    const total = rows.length
    const open = rows.filter(r => r.status === 'вакансия').length
    const stores = new Set(rows.map(r => r.store?.id).filter(Boolean)).size
    return { total, open, stores }
  }, [rows])

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
        <AssessmentOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box>
          <Typography variant="h5">Сводный План</Typography>
          <Typography variant="body2" color="text.secondary">Все вакансии по всем магазинам · правка admin</Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={4}><Stat label="Всего позиций" value={stats.total} /></Grid>
        <Grid item xs={4}><Stat label="Открытых вакансий" value={stats.open} color="warning.main" /></Grid>
        <Grid item xs={4}><Stat label="Магазинов" value={stats.stores} color="primary.main" /></Grid>
      </Grid>

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          processRowUpdate={editable ? handleRowUpdate : undefined}
          onProcessRowUpdateError={(err) => toast(err.message, 'error')}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
          slots={{ toolbar: Toolbar }}
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
