import { useState, useEffect } from 'react'
import {
  Box, Paper, Typography, Chip, IconButton, Tooltip,
  MenuItem, Select, FormControl, Alert, Snackbar, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Autocomplete, TextField, CircularProgress,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import TuneIcon from '@mui/icons-material/Tune'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import { supabase } from '../lib/supabase'
import { ROLES, ROLE_META, can } from '../lib/rbac'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { useStores } from '../hooks/useStores'
import RoleGuard from '../components/RoleGuard'

/** Диалог создания пользователя (через Edge Function admin-create-user) */
function AddUserDialog({ onClose, onCreated, onError }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('viewer')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    // слаг задеплоенной функции (Supabase создал её под автоименем swift-api)
    const { data, error } = await supabase.functions.invoke('swift-api', {
      body: { email: email.trim(), password, role, name: name.trim() },
    })
    setSaving(false)
    if (error) {
      let msg = error.message
      try {
        const ctx = error.context
        if (ctx && typeof ctx.text === 'function') {
          const txt = await ctx.text()
          let detail = txt
          try { const b = JSON.parse(txt); if (b?.error) detail = b.error } catch { /* not json */ }
          msg = `(${ctx.status ?? '?'}) ${detail || error.message}`
        }
      } catch { /* ignore */ }
      return onError(msg)
    }
    if (data?.error) return onError(data.error)
    onCreated()
  }
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem' }}>Новый пользователь</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField label="ФИО" value={name} onChange={e => setName(e.target.value)} fullWidth sx={{ mt: 1 }} placeholder="Иванов Иван Иванович" />
        <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} fullWidth autoComplete="off" />
        <TextField label="Пароль" value={password} onChange={e => setPassword(e.target.value)} helperText="Минимум 6 символов" fullWidth autoComplete="new-password" />
        <TextField label="Роль" value={role} onChange={e => setRole(e.target.value)} select fullWidth>
          {Object.entries(ROLE_META).map(([v, m]) => <MenuItem key={v} value={v}>{m.label}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">Отмена</Button>
        <Button onClick={save} variant="contained" size="small" disabled={saving || !email.trim() || password.length < 6}>Создать</Button>
      </DialogActions>
    </Dialog>
  )
}

/** Диалог назначения магазинов (director) / регионов (rm) пользователю */
function AccessDialog({ user, stores, regions, api, onClose, onSaved, onError }) {
  const [storeSel, setStoreSel] = useState([])
  const [regionSel, setRegionSel] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const isDirector = user.role === ROLES.DIRECTOR
  const isRm = user.role === ROLES.RM

  useEffect(() => {
    let active = true
    api.getUserScope(user.id).then(({ storeIds, regionIds }) => {
      if (!active) return
      setStoreSel(stores.filter(s => storeIds.includes(s.id)))
      setRegionSel(regions.filter(r => regionIds.includes(r.id)))
      setLoading(false)
    })
    return () => { active = false }
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true)
    try {
      // синхронизируем оба набора по роли (неактуальный обнуляем); ФИО — в dm_name/regions.name
      await api.setUserStores(user.id, isDirector ? storeSel.map(s => s.id) : [], user.name)
      await api.setUserRegions(user.id, isRm ? regionSel.map(r => r.id) : [], user.name)
      onSaved('Доступ сохранён')
      onClose()
    } catch (err) {
      onError(err.message ?? 'Ошибка сохранения доступа')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem' }}>
        Доступ · {user.email}
        <Chip label={(ROLE_META[user.role] ?? ROLE_META.viewer).label} color={(ROLE_META[user.role] ?? ROLE_META.viewer).color} size="small" sx={{ ml: 1, height: 20 }} />
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : isDirector ? (
          <Autocomplete
            multiple
            options={stores}
            value={storeSel}
            onChange={(_, v) => setStoreSel(v)}
            getOptionLabel={s => `${s.code ? s.code + ' · ' : ''}${s.name}`}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={params => <TextField {...params} label="Магазины директора" placeholder="Выберите магазины" sx={{ mt: 1 }} />}
          />
        ) : isRm ? (
          <Autocomplete
            multiple
            options={regions}
            value={regionSel}
            onChange={(_, v) => setRegionSel(v)}
            getOptionLabel={r => `${r.code}${r.name ? ' — ' + r.name : ''}`}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={params => <TextField {...params} label="Регионы РМ" placeholder="Выберите регионы" sx={{ mt: 1 }} />}
          />
        ) : (
          <Alert severity="info" sx={{ mt: 1 }}>
            Для роли «{(ROLE_META[user.role] ?? ROLE_META.viewer).label}» скоуп магазинов/регионов не требуется.
            Назначьте роль <b>Директор</b> или <b>РМ</b>, чтобы задать доступ к магазинам.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">Отмена</Button>
        <Button onClick={save} variant="contained" size="small" disabled={saving || loading || (!isDirector && !isRm)}>
          {saving ? <CircularProgress size={16} /> : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function UsersPage() {
  const { role: myRole } = useAuth()
  const isAdmin = can(myRole, 'canManageUsers')
  const { users, loading, error, updateRole, updateName, getUserScope, setUserStores, setUserRegions, refetch } = useUsers()
  const { stores, regions } = useStores()
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })
  const [accessUser, setAccessUser] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  const toast = (message, severity = 'success') => setSnack({ open: true, message, severity })

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateRole(userId, newRole)
      toast('Роль обновлена')
    } catch (err) {
      toast(err.message ?? 'Ошибка', 'error')
    }
  }

  const handleRowUpdate = async (newRow, oldRow) => {
    if (newRow.name !== oldRow.name) {
      try { await updateName(newRow.id, newRow.name); toast('ФИО обновлено') }
      catch (err) { toast(err.message ?? 'Ошибка', 'error'); throw err }
    }
    return newRow
  }

  const columns = [
    {
      field: 'email', headerName: 'Email', flex: 1, minWidth: 220,
      renderCell: ({ row }) => {
        const initials = (row.email ?? '??').slice(0, 2).toUpperCase()
        return (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 600, bgcolor: 'rgba(62,207,142,0.12)', color: 'primary.main', border: '1px solid rgba(62,207,142,0.2)' }}>
              {initials}
            </Avatar>
            <Typography sx={{ fontSize: '0.8125rem' }}>{row.email}</Typography>
          </Box>
        )
      },
    },
    { field: 'name', headerName: 'ФИО', width: 200, editable: true },
    {
      field: 'role', headerName: 'Роль', width: 170,
      renderCell: ({ row }) => {
        const meta = ROLE_META[row.role] ?? ROLE_META.viewer
        return (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            {isAdmin ? (
              <FormControl size="small" variant="standard" sx={{ minWidth: 130 }}>
                <Select value={row.role ?? ROLES.VIEWER} onChange={(e) => handleRoleChange(row.id, e.target.value)} disableUnderline sx={{ fontSize: '0.8rem' }}>
                  {Object.entries(ROLE_META).map(([value, m]) => (
                    <MenuItem key={value} value={value}>
                      <Chip label={m.label} color={m.color} size="small" sx={{ height: 20, fontSize: '0.7rem', borderRadius: 1, pointerEvents: 'none' }} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Chip label={meta.label} color={meta.color} size="small" sx={{ height: 20, fontSize: '0.7rem', borderRadius: 1 }} />
            )}
          </Box>
        )
      },
    },
    ...(isAdmin ? [{
      field: 'access', headerName: 'Доступ', width: 110, sortable: false, filterable: false,
      renderCell: ({ row }) => {
        const scoped = row.role === ROLES.DIRECTOR || row.role === ROLES.RM
        return (
          <Tooltip title={scoped ? 'Назначить магазины/регионы' : 'Доступен для ролей Директор / РМ'}>
            <span>
              <IconButton size="small" onClick={() => setAccessUser(row)} disabled={!scoped} sx={{ color: scoped ? 'primary.main' : 'text.disabled' }}>
                <TuneIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )
      },
    }] : []),
    {
      field: 'created_at', headerName: 'Регистрация', width: 150,
      valueFormatter: (value) => value ? new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
  ]

  return (
    <RoleGuard permission="canViewUsers">
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ mb: 0.25 }}>{isAdmin ? 'Пользователи и доступы' : 'Мой профиль'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {isAdmin
                ? <>Роль определяет права; для <b>Директора</b> и <b>РМ</b> задайте магазины/регионы кнопкой <TuneIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} /></>
                : 'Двойной клик по «ФИО», чтобы изменить своё имя'}
            </Typography>
          </Box>
          {isAdmin && (
            <Button variant="contained" size="small" startIcon={<PersonAddAlt1Icon />} onClick={() => setAddOpen(true)}>
              Пользователь
            </Button>
          )}
        </Box>

        {error && <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}

        <Paper sx={{ flex: 1, minHeight: 0 }}>
          <DataGrid
            rows={users}
            columns={columns}
            loading={loading}
            processRowUpdate={handleRowUpdate}
            onProcessRowUpdateError={(err) => toast(err.message, 'error')}
            disableRowSelectionOnClick
            sx={{ border: 'none', '& .MuiDataGrid-cell--editable': { color: 'primary.main' } }}
          />
        </Paper>

        {addOpen && (
          <AddUserDialog
            onClose={() => setAddOpen(false)}
            onCreated={() => { setAddOpen(false); toast('Пользователь создан'); refetch() }}
            onError={(m) => toast(m, 'error')}
          />
        )}

        {accessUser && (
          <AccessDialog
            user={accessUser}
            stores={stores}
            regions={regions}
            api={{ getUserScope, setUserStores, setUserRegions }}
            onClose={() => setAccessUser(null)}
            onSaved={(m) => toast(m)}
            onError={(m) => toast(m, 'error')}
          />
        )}

        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity={snack.severity} sx={{ fontSize: '0.8rem' }}>{snack.message}</Alert>
        </Snackbar>
      </Box>
    </RoleGuard>
  )
}
