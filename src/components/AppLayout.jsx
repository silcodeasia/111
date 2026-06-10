import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Chip, Divider, Tooltip, IconButton,
  AppBar, Toolbar,
} from '@mui/material'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import CircleIcon from '@mui/icons-material/Circle'
import { useAuth } from '../context/AuthContext'
import { can, ROLE_META } from '../lib/rbac'

const DRAWER_WIDTH = 224

const NAV_ITEMS = [
  { label: 'Панель', icon: DashboardOutlinedIcon, path: '/', permission: null },
  { label: 'Магазины', icon: StorefrontOutlinedIcon, path: '/stores', permission: 'canViewStores' },
  { label: 'План', icon: AssessmentOutlinedIcon, path: '/plan', permission: 'canViewPlan' },
  { label: 'РМ · регион', icon: MapOutlinedIcon, path: '/rm', permission: 'canViewRegion' },
  { label: 'HR', icon: BadgeOutlinedIcon, path: '/hr', permission: 'canManageHr' },
  { label: 'Товары', icon: TableChartOutlinedIcon, path: '/products', permission: null },
  { label: 'Добавить товар', icon: AddCircleOutlineIcon, path: '/products/new', permission: 'canCreate' },
  { label: 'Пользователи', icon: PeopleOutlineIcon, path: '/users', permission: 'canManageUsers' },
]

function NavItem({ item, role }) {
  const location = useLocation()
  const locked = item.permission && !can(role, item.permission)
  const active = location.pathname === item.path

  const btn = (
    <ListItemButton
      component={locked ? 'div' : Link}
      to={locked ? undefined : item.path}
      selected={active}
      disabled={locked}
      sx={{
        mx: 1,
        borderRadius: 1.5,
        mb: 0.25,
        '&.Mui-selected': {
          bgcolor: 'rgba(62,207,142,0.10)',
          color: 'primary.main',
          '& .MuiListItemIcon-root': { color: 'primary.main' },
          '&:hover': { bgcolor: 'rgba(62,207,142,0.15)' },
        },
        '&.Mui-disabled': { opacity: 0.35 },
      }}
    >
      <ListItemIcon sx={{ minWidth: 34, color: active ? 'primary.main' : 'text.secondary' }}>
        <item.icon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary={item.label}
        primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: active ? 500 : 400 }}
      />
    </ListItemButton>
  )

  return locked ? (
    <Tooltip title={`Требуется право: ${item.permission}`} placement="right">
      <span>{btn}</span>
    </Tooltip>
  ) : btn
}

export default function AppLayout({ children }) {
  const { role, session, signOut } = useAuth()
  const navigate = useNavigate()
  const roleMeta = ROLE_META[role] ?? ROLE_META.viewer

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const email = session?.user?.email ?? '—'
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ── Sidebar ── */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {/* Logo */}
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 30, height: 30, borderRadius: 1.5,
              bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0F1117', lineHeight: 1 }}>D</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>DataPanel</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <CircleIcon sx={{ fontSize: 7, color: 'primary.main' }} />
              <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>supabase</Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'divider', mb: 1 }} />

        {/* Nav */}
        <List dense disablePadding sx={{ flex: 1 }}>
          <Typography
            variant="caption"
            sx={{ px: 2.5, pt: 1, pb: 0.5, display: 'block', color: 'text.disabled', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}
          >
            Навигация
          </Typography>
          {NAV_ITEMS.filter(item => !item.permission || can(role, item.permission)).map(item => (
            <NavItem key={item.path} item={item} role={role} />
          ))}
        </List>

        <Divider sx={{ borderColor: 'divider' }} />

        {/* User */}
        <Box sx={{ px: 1.5, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, py: 0.75 }}>
            <Avatar
              sx={{
                width: 32, height: 32, fontSize: 12, fontWeight: 600,
                bgcolor: 'rgba(62,207,142,0.15)',
                color: 'primary.main',
                border: '1px solid rgba(62,207,142,0.25)',
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {email}
              </Typography>
              <Chip
                label={roleMeta.label}
                color={roleMeta.color}
                size="small"
                sx={{ height: 18, fontSize: '0.68rem', mt: 0.25, borderRadius: 1 }}
              />
            </Box>
            <Tooltip title="Выйти">
              <IconButton size="small" onClick={handleSignOut} sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Drawer>

      {/* ── Main ── */}
      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            color: 'text.primary',
          }}
        >
          <Toolbar variant="dense" sx={{ minHeight: 52, gap: 1 }}>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CircleIcon sx={{ fontSize: 8, color: 'primary.main' }} />
              <Typography sx={{ fontSize: 11, color: 'text.secondary', fontFamily: 'monospace' }}>подключено</Typography>
            </Box>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
