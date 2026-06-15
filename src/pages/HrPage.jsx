import { useState, useEffect } from 'react'
import {
  Box, Paper, Typography, Alert, Snackbar, Button, Chip,
  FormControl, InputLabel, Select, MenuItem, Autocomplete, TextField,
} from '@mui/material'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import { supabase } from '../lib/supabase'
import { useStores } from '../hooks/useStores'
import RoleGuard from '../components/RoleGuard'

export default function HrPage() {
  const { stores } = useStores()
  const [recruiters, setRecruiters] = useState([])
  const [recruiterId, setRecruiterId] = useState('')
  const [selStores, setSelStores] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })
  const toast = (m, s = 'success') => setSnack({ open: true, message: m, severity: s })

  // пользователи с ролью «Рекрутер»
  useEffect(() => {
    supabase.from('profiles').select('id, name, email').eq('role', 'recruiter').order('name')
      .then(({ data }) => setRecruiters(data ?? []))
  }, [])

  // закреплённые магазины выбранного рекрутера
  useEffect(() => {
    if (!recruiterId) { setSelStores([]); return }
    let active = true
    setLoading(true)
    supabase.from('recruiter_stores').select('store_id').eq('recruiter_id', recruiterId).then(({ data }) => {
      if (!active) return
      const ids = new Set((data ?? []).map(r => r.store_id))
      setSelStores(stores.filter(s => ids.has(s.id)))
      setLoading(false)
    })
    return () => { active = false }
  }, [recruiterId, stores])

  const save = async () => {
    setSaving(true)
    try {
      const del = await supabase.from('recruiter_stores').delete().eq('recruiter_id', recruiterId)
      if (del.error) throw del.error
      if (selStores.length) {
        const { error } = await supabase.from('recruiter_stores')
          .insert(selStores.map(s => ({ recruiter_id: recruiterId, store_id: s.id })))
        if (error) throw error
      }
      toast('Закрепления сохранены')
    } catch (e) {
      toast(e.message ?? 'Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <RoleGuard permission="canManageHr">
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <BadgeOutlinedIcon sx={{ color: 'primary.main' }} />
          <Box>
            <Typography variant="h5">Рекрутеры</Typography>
            <Typography variant="body2" color="text.secondary">
              Закрепление магазинов за рекрутером · один магазин может быть у нескольких рекрутеров
            </Typography>
          </Box>
        </Box>

        <Paper sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 680 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Рекрутер</InputLabel>
            <Select value={recruiterId} label="Рекрутер" onChange={e => setRecruiterId(e.target.value)}>
              {recruiters.map(r => <MenuItem key={r.id} value={r.id}>{r.name || r.email}</MenuItem>)}
            </Select>
          </FormControl>

          {recruiters.length === 0 && (
            <Alert severity="info">
              Нет пользователей с ролью «Рекрутер». Создай их на странице «Пользователи» (роль «Рекрутер»), затем закрепи здесь магазины.
            </Alert>
          )}

          {recruiterId && (
            <>
              <Autocomplete
                multiple options={stores} value={selStores} loading={loading}
                onChange={(_, v) => setSelStores(v)}
                getOptionLabel={s => `${s.code ? s.code + ' · ' : ''}${s.name}`}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderInput={p => <TextField {...p} label="Закреплённые магазины" placeholder="Выберите магазины" />}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip size="small" label={`магазинов: ${selStores.length}`} />
                <Button variant="contained" size="small" onClick={save} disabled={saving}>Сохранить</Button>
              </Box>
            </>
          )}
        </Paper>

        <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert severity={snack.severity} sx={{ fontSize: '0.8rem' }} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.message}</Alert>
        </Snackbar>
      </Box>
    </RoleGuard>
  )
}
