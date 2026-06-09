import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Button, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Alert, Snackbar,
} from '@mui/material'
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarQuickFilter,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarExport,
} from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/rbac'
import { useProducts } from '../hooks/useProducts'

const STATUS_COLORS = {
  active: 'success',
  inactive: 'default',
  order_only: 'warning',
}
const STATUS_LABELS = {
  active: 'В наличии',
  inactive: 'Нет в наличии',
  order_only: 'Под заказ',
}

/** Кастомный тулбар DataGrid */
function Toolbar({ onAdd, canCreate, onRefresh }) {
  return (
    <GridToolbarContainer sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarExport csvOptions={{ fileName: 'products', utf8WithBom: true }} />
        <Tooltip title="Обновить">
          <IconButton size="small" onClick={onRefresh} sx={{ ml: 0.5 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <GridToolbarQuickFilter
          debounceMs={300}
          sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
        />
        {canCreate && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onAdd} sx={{ whiteSpace: 'nowrap' }}>
            Добавить
          </Button>
        )}
      </Box>
    </GridToolbarContainer>
  )
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const { rows, loading, error, clearError, refetch, remove, processRowUpdate } = useProducts()

  const [deleteId, setDeleteId] = useState(null)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })

  const toast = (message, severity = 'success') => setSnack({ open: true, message, severity })

  const columns = useMemo(() => {
    const base = [
      {
        field: 'id',
        headerName: 'ID',
        width: 70,
        type: 'number',
        renderCell: ({ value }) => (
          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
            #{value}
          </Typography>
        ),
      },
      {
        field: 'name',
        headerName: 'Название',
        flex: 1,
        minWidth: 180,
        editable: can(role, 'canEdit'),
      },
      {
        field: 'sku',
        headerName: 'Артикул',
        width: 130,
        editable: can(role, 'canEdit'),
        renderCell: ({ value }) => (
          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
            {value ?? '—'}
          </Typography>
        ),
      },
      {
        field: 'category',
        headerName: 'Категория',
        width: 140,
        editable: can(role, 'canEdit'),
        type: 'singleSelect',
        valueOptions: ['Electronics', 'Accessories', 'Software', 'Services'],
      },
      {
        field: 'price',
        headerName: 'Цена',
        width: 110,
        type: 'number',
        editable: can(role, 'canEdit'),
        valueFormatter: (value) =>
          value != null
            ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
            : '—',
      },
      {
        field: 'stock',
        headerName: 'Остаток',
        width: 90,
        type: 'number',
        editable: can(role, 'canEdit'),
      },
      {
        field: 'status',
        headerName: 'Статус',
        width: 140,
        editable: can(role, 'canEdit'),
        type: 'singleSelect',
        valueOptions: ['active', 'inactive', 'order_only'],
        renderCell: ({ value }) => (
          <Chip
            label={STATUS_LABELS[value] ?? value}
            color={STATUS_COLORS[value] ?? 'default'}
            size="small"
            sx={{ height: 20, fontSize: '0.7rem', borderRadius: 1 }}
          />
        ),
      },
      {
        field: 'is_featured',
        headerName: 'Хит',
        width: 70,
        type: 'boolean',
        editable: can(role, 'canEdit'),
      },
    ]

    // Admin-only колонки
    if (can(role, 'canViewAdminFields')) {
      base.push(
        {
          field: 'internal_code',
          headerName: 'Внутр. код',
          width: 120,
          editable: true,
          renderHeader: () => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'warning.main', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Внутр. код
              </Typography>
            </Box>
          ),
        },
        {
          field: 'supplier',
          headerName: 'Поставщик',
          width: 140,
          editable: true,
        }
      )
    }

    // Колонка действий
    base.push({
      field: '__actions',
      headerName: '',
      width: can(role, 'canDelete') ? 88 : 48,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          {can(role, 'canEdit') && (
            <Tooltip title="Редактировать">
              <IconButton
                size="small"
                onClick={() => navigate(`/products/${row.id}/edit`)}
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                <EditOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {can(role, 'canDelete') && (
            <Tooltip title="Удалить">
              <IconButton
                size="small"
                onClick={() => setDeleteId(row.id)}
                sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    })

    return base
  }, [role, navigate])

  const handleProcessRowUpdate = async (newRow, oldRow) => {
    try {
      const updated = await processRowUpdate(newRow, oldRow)
      toast('Запись обновлена')
      return updated
    } catch (err) {
      toast(err.message ?? 'Ошибка при сохранении', 'error')
      throw err
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await remove(deleteId)
      toast('Запись удалена')
    } catch (err) {
      toast(err.message ?? 'Ошибка при удалении', 'error')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ mb: 0.25 }}>Товары</Typography>
        <Typography variant="body2" color="text.secondary">
          Таблица <code style={{ fontSize: '0.75rem', color: '#3ECF8E' }}>products</code> · Supabase · RLS активен
          {can(role, 'canEdit') && ' · Двойной клик по ячейке для редактирования'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          processRowUpdate={can(role, 'canEdit') ? handleProcessRowUpdate : undefined}
          onProcessRowUpdateError={(err) => toast(err.message, 'error')}
          isCellEditable={({ field }) => field !== '__actions' && can(role, 'canEdit')}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          slots={{
            toolbar: Toolbar,
          }}
          slotProps={{
            toolbar: {
              onAdd: () => navigate('/products/new'),
              canCreate: can(role, 'canCreate'),
              onRefresh: refetch,
            },
          }}
          sx={{ border: 'none' }}
        />
      </Paper>

      {/* Диалог подтверждения удаления */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem' }}>Подтвердите удаление</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            Запись будет удалена из Supabase без возможности восстановления.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setDeleteId(null)} variant="outlined" size="small">Отмена</Button>
          <Button onClick={handleDelete} variant="contained" color="error" size="small">Удалить</Button>
        </DialogActions>
      </Dialog>

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
