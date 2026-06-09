import { Box, Grid, Paper, Typography, Chip, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { useAuth } from '../context/AuthContext'
import { PERMISSIONS, ROLE_META } from '../lib/rbac'

const PERM_LABELS = {
  canCreate: 'Создание записей',
  canEdit: 'Редактирование',
  canDelete: 'Удаление',
  canManageUsers: 'Управление пользователями',
  canViewAdminFields: 'Просмотр admin-полей',
}

function StatCard({ label, value, sub }) {
  return (
    <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
      <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.5px', mt: 0.25 }}>
        {value}
      </Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  )
}

export default function DashboardPage() {
  const { role, session } = useAuth()
  const perms = PERMISSIONS[role] ?? {}
  const roleMeta = ROLE_META[role] ?? ROLE_META.viewer

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>
          Добро пожаловать
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">Вы вошли как</Typography>
          <Typography variant="body2" color="text.primary">{session?.user?.email}</Typography>
          <Chip label={roleMeta.label} color={roleMeta.color} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
        </Box>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}><StatCard label="Всего записей" value="247" sub="таблица products" /></Grid>
        <Grid item xs={12} sm={4}><StatCard label="Изменений сегодня" value="18" sub="последнее — 14:32" /></Grid>
        <Grid item xs={12} sm={4}><StatCard label="Пользователей" value="12" sub="3 admin · 5 editor · 4 viewer" /></Grid>
      </Grid>

      <Paper>
        <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontSize: '0.9rem' }}>Ваши права доступа</Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Действие</TableCell>
              <TableCell align="center">Статус</TableCell>
              <TableCell>Таблица</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Просмотр записей</TableCell>
              <TableCell align="center"><CheckCircleOutlineIcon sx={{ color: 'primary.main', fontSize: 18 }} /></TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>products, orders</TableCell>
            </TableRow>
            {Object.entries(PERM_LABELS).map(([key, label]) => (
              <TableRow key={key}>
                <TableCell>{label}</TableCell>
                <TableCell align="center">
                  {perms[key]
                    ? <CheckCircleOutlineIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                    : <CancelOutlinedIcon sx={{ color: 'error.main', fontSize: 18 }} />}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                  {perms[key] ? 'products' : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}
