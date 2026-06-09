import { Box, Paper, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/rbac'

/**
 * Оборачивает дочерние элементы и показывает заглушку,
 * если у пользователя нет нужного права.
 *
 * Использование:
 *   <RoleGuard permission="canEdit">
 *     <EditButton />
 *   </RoleGuard>
 *
 *   // Только рендер без fallback:
 *   <RoleGuard permission="canDelete" silent>
 *     <DeleteButton />
 *   </RoleGuard>
 */
export default function RoleGuard({ permission, children, silent = false }) {
  const { role } = useAuth()
  const allowed = can(role, permission)

  if (allowed) return children

  if (silent) return null

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        py: 6,
        px: 3,
        bgcolor: 'background.paper',
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          bgcolor: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LockOutlinedIcon sx={{ color: 'error.main', fontSize: 24 }} />
      </Box>
      <Typography variant="h6" sx={{ fontSize: '0.95rem' }}>Доступ ограничен</Typography>
      <Typography variant="body2" color="text.secondary" maxWidth={280}>
        Ваша роль <strong style={{ color: '#E2E8F0' }}>{role}</strong> не имеет права{' '}
        <code style={{ fontSize: '0.78rem', color: '#3ECF8E' }}>{permission}</code>.
        Обратитесь к администратору.
      </Typography>
    </Paper>
  )
}
