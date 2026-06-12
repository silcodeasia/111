import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Chip, Divider, Tooltip, IconButton,
} from '@mui/material'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import CircleIcon from '@mui/icons-material/Circle'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import { useAuth } from '../context/AuthContext'
import { can, ROLE_META } from '../lib/rbac'

const DRAWER_WIDTH = 224
const COLLAPSED_WIDTH = 64

const NAV_ITEMS = [
  { label: 'План', icon: AssessmentOutlinedIcon, path: '/plan', permission: 'canViewPlan' },
  { label: 'Штатное расписание', icon: ListAltOutlinedIcon, path: '/staffing', permission: 'canManageStaffing' },
  { label: 'РМ · регион', icon: MapOutlinedIcon, path: '/rm', permission: 'canViewRegion' },
  { label: 'Магазины', icon: StorefrontOutlinedIcon, path: '/stores', permission: 'canViewStores' },
  { label: 'HR', icon: BadgeOutlinedIcon, path: '/hr', permission: 'canManageHr' },
  { label: 'Пользователи', icon: PeopleOutlineIcon, path: '/users', permission: 'canViewUsers' },
]

function NavItem({ item, expanded }) {
  const location = useLocation()
  const active = location.pathname === item.path

  const btn = (
    <ListItemButton
      component={Link}
      to={item.path}
      selected={active}
      sx={{
        mx: 1,
        borderRadius: 1.5,
        mb: 0.25,
        minHeight: 40,
        justifyContent: expanded ? 'initial' : 'center',
        px: expanded ? 1.5 : 1,
        '&.Mui-selected': {
          bgcolor: 'rgba(62,207,142,0.10)',
          color: 'primary.main',
          '& .MuiListItemIcon-root': { color: 'primary.main' },
          '&:hover': { bgcolor: 'rgba(62,207,142,0.15)' },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 0, mr: expanded ? 1.25 : 0, justifyContent: 'center', color: active ? 'primary.main' : 'text.secondary' }}>
        <item.icon fontSize="small" />
      </ListItemIcon>
      {expanded && (
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: active ? 500 : 400, noWrap: true }}
        />
      )}
    </ListItemButton>
  )

  // в свёрнутом виде показываем подпись тултипом
  return expanded ? btn : (
    <Tooltip title={item.label} placement="right">{btn}</Tooltip>
  )
}

export default function AppLayout({ children }) {
  const { role, session, signOut } = useAuth()
  const navigate = useNavigate()
  const roleMeta = ROLE_META[role] ?? ROLE_META.viewer

  const [pinned, setPinned] = useState(() => localStorage.getItem('sidebarPinned') !== 'false')
  const [hovered, setHovered] = useState(false)
  const expanded = pinned || hovered
  const overlay = hovered && !pinned // раскрытие поверх контента

  const togglePin = () => setPinned(p => {
    localStorage.setItem('sidebarPinned', String(!p))
    return !p
  })

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const email = session?.user?.email ?? '—'
  const initials = email.slice(0, 2).toUpperCase()

  const items = NAV_ITEMS.filter(item => !item.permission || can(role, item.permission))

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* ── Sidebar ── */}
      <Drawer
        variant="permanent"
        // зарезервированная ширина зависит только от pinned → при hover контент не дёргается
        sx={{
          width: pinned ? DRAWER_WIDTH : COLLAPSED_WIDTH,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          '& .MuiDrawer-paper': {
            width: expanded ? DRAWER_WIDTH : COLLAPSED_WIDTH,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            transition: 'width 0.2s ease',
            zIndex: theme => theme.zIndex.drawer + (overlay ? 1 : 0),
            boxShadow: overlay ? 8 : 'none',
          },
        }}
        PaperProps={{
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }}
      >
        {/* Logo + Pin */}
        <Box sx={{ px: expanded ? 2 : 0, py: 2, display: 'flex', alignItems: 'center', gap: 1.25, justifyContent: expanded ? 'space-between' : 'center', minHeight: 64 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: 1.5, bgcolor: 'error.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1 }}>Т</Typography>
            </Box>
            {expanded && (
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }} noWrap>Toimart</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                  <CircleIcon sx={{ fontSize: 7, color: 'primary.main' }} />
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>подключено</Typography>
                </Box>
              </Box>
            )}
          </Box>
          {expanded && (
            <Tooltip title={pinned ? 'Открепить меню' : 'Закрепить меню'} placement="right">
              <IconButton size="small" onClick={togglePin} sx={{ color: pinned ? 'primary.main' : 'text.disabled' }}>
                {pinned ? <PushPinIcon sx={{ fontSize: 18 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Divider sx={{ borderColor: 'divider', mb: 1 }} />

        {/* Nav */}
        <List dense disablePadding sx={{ flex: 1 }}>
          {expanded && (
            <Typography variant="caption" sx={{ px: 2.5, pt: 1, pb: 0.5, display: 'block', color: 'text.disabled', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Навигация
            </Typography>
          )}
          {items.map(item => (
            <NavItem key={item.path} item={item} expanded={expanded} />
          ))}
        </List>

        <Divider sx={{ borderColor: 'divider' }} />

        {/* User */}
        <Box sx={{ px: 1.5, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: expanded ? 1 : 0, py: 0.75, justifyContent: expanded ? 'flex-start' : 'center' }}>
            <Tooltip title={expanded ? '' : `${email} · ${roleMeta.label}`} placement="right">
              <Avatar sx={{ width: 32, height: 32, flexShrink: 0, fontSize: 12, fontWeight: 600, bgcolor: 'rgba(62,207,142,0.15)', color: 'primary.main', border: '1px solid rgba(62,207,142,0.25)' }}>
                {initials}
              </Avatar>
            </Tooltip>
            {expanded && (
              <>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</Typography>
                  <Chip label={roleMeta.label} color={roleMeta.color} size="small" sx={{ height: 18, fontSize: '0.68rem', mt: 0.25, borderRadius: 1 }} />
                </Box>
                <Tooltip title="Выйти">
                  <IconButton size="small" onClick={handleSignOut} sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
                    <LogoutIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* ── Main ── */}
      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <Box sx={{ flex: 1, p: 3, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
