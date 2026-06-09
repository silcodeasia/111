import { useState } from 'react'
import {
  Box, Paper, Typography, Chip, IconButton, Tooltip,
  MenuItem, Select, FormControl, Alert, Snackbar, Avatar,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { useAuth } from '../context/AuthContext'
import { ROLES, ROLE_META } from '../lib/rbac'
import { useUsers } from '../hooks/useUsers'
import RoleGuard from '../components/RoleGuard'

export default function UsersPage() {
  const { role: currentUserRole } = useAuth()
  const { users, loading, error, updateRole } = useUsers()
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })

  const toast = (message, severity = 'success') => setSnack({ open: true, message, severity })

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateRole(userId, newRole)
      toast('Роль обновлена')
    } catch (err) {
      toast(err.message ?? 'Ошибка', 'error')
    }
  }

  const columns = [
    {
      field: 'id',
      headerName: 'ID',
      width: 80,
      renderCell: ({ value }) => (
        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'text.disabled' }}>
          {String(value).slice(0, 8)}…
        </Typography>
      ),
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      minWidth: 200,
      renderCell: ({ row }) => {
        const initials = (row.email ?? '??').slice(0, 2).toUpperCase()
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Avatar
              sx={{
                width: 28, height: 28, fontSize: 11, fontWeight: 600,
                bgcolor: 'rgba(62,207,142,0.12)', color: 'primary.main',
                border: '1px solid rgba(62,207,142,0.2)',
              }}
            >
              {initials}
            </Avatar>
            <Typography sx={{ fontSize: '0.8125rem' }}>{row.email}</Typography>
          </Box>
        )
      },
    },
    {
      field: 'name',
      headerName: 'Имя',
      width: 160,
    },
    {
      field: 'role',
      headerName: 'Роль',
      width: 180,
      renderCell: ({ row }) => {
        const meta = ROLE_META[row.role] ?? ROLE_META.viewer
        return (
          <FormControl size="small" variant="standard" sx={{ minWidth: 130 }}>
            <Select
              value={row.role ?? ROLES.VIEWER}
              onChange={(e) => handleRoleChange(row.id, e.target.value)}
              disableUnderline
              sx={{ fontSize: '0.8rem' }}
            >
              {Object.entries(ROLE_META).map(([value, m]) => (
                <MenuItem key={value} value={value}>
                  <Chip
                    label={m.label}
                    color={m.color}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem', borderRadius: 1, pointerEvents: 'none' }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )
      },
    },
    {
      field: 'created_at',
      headerName: 'Дата регистрации',
      width: 160,
      valueFormatter: (value) =>
        value ? new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
  ]

  return (
    <RoleGuard permission="canManageUsers">
      <Box>
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="h5" sx={{ mb: 0.25 }}>Пользователи</Typography>
          <Typography variant="body2" color="text.secondary">
            Таблица <code style={{ fontSize: '0.75rem', color: '#3ECF8E' }}>profiles</code> · управление ролями
          </Typography>
        </Box>

        {error && <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}

        <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
          В продакшене смену ролей выполняйте через Supabase Edge Function с service_role ключом.
          Прямое обновление <code>profiles.role</code> должно быть закрыто RLS для всех, кроме admin.
        </Alert>

        <Paper sx={{ height: 500 }}>
          <DataGrid
            rows={users}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            pageSizeOptions={[25, 50]}
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
          <Alert severity={snack.severity} sx={{ fontSize: '0.8rem' }}>
            {snack.message}
          </Alert>
        </Snackbar>
      </Box>
    </RoleGuard>
  )
}
