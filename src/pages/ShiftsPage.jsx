import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box, Paper, Typography, Alert, Button, TextField, MenuItem, Stack, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell,
  TableHead, TableRow, Snackbar, Autocomplete,
} from '@mui/material'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import AddIcon from '@mui/icons-material/Add'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useStores } from '../hooks/useStores'

const payLabel = (o) =>
  o.pay != null && o.pay !== '' ? `${Number(o.pay).toLocaleString('ru-RU')} ₸ / смена`
    : (o.pay_note || 'По ставке смены')
const statusMeta = { open: ['Открыта', 'success'], filled: ['Закрыта', 'default'], cancelled: ['Отменена', 'error'] }
const emptyForm = { position: '', shift_date: '', headcount: 1, pay: '', pay_note: '', starts_at: '', ends_at: '', notes: '' }

export default function ShiftsPage() {
  const { role, session, storeIds, regionIds } = useAuth()
  const { stores } = useStores()

  const myStores = useMemo(() => {
    if (role === 'admin') return stores
    if (role === 'director') return stores.filter(s => storeIds.includes(s.id))
    if (role === 'rm') return stores.filter(s => regionIds.includes(s.region_id))
    return []
  }, [stores, role, storeIds, regionIds])

  const [storeId, setStoreId] = useState('')
  useEffect(() => { if (storeId === '' && myStores.length) setStoreId(myStores[0].id) }, [myStores, storeId])

  const [positions, setPositions] = useState([])
  const [offers, setOffers] = useState([])
  const [missing, setMissing] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState(emptyForm)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const [dlgOffer, setDlgOffer] = useState(null)
  const [bookings, setBookings] = useState([])

  const loadPositions = useCallback(async (sid) => {
    const { data } = await supabase.from('staffing').select('position').eq('store_id', sid)
    setPositions([...new Set((data || []).map(r => r.position).filter(Boolean))])
  }, [])

  const loadOffers = useCallback(async (sid) => {
    if (!sid) return
    const { data, error } = await supabase
      .from('shift_offers').select('*, shift_bookings(count)')
      .eq('store_id', sid).order('shift_date', { ascending: true })
    if (error) { setMissing(true); setOffers([]) }
    else { setMissing(false); setOffers(data || []) }
  }, [])

  useEffect(() => { if (storeId) { loadPositions(storeId); loadOffers(storeId) } }, [storeId, loadPositions, loadOffers])

  const create = async () => {
    if (!storeId || !form.position || !form.shift_date) { setToast('Укажите магазин, должность и дату'); return }
    const { error } = await supabase.from('shift_offers').insert({
      store_id: storeId, position: form.position, shift_date: form.shift_date,
      headcount: Number(form.headcount) || 1,
      pay: form.pay === '' ? null : Number(form.pay),
      pay_note: form.pay_note || null,
      starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      notes: form.notes || null, created_by: session?.user?.id ?? null,
    })
    if (error) { setToast('Ошибка: ' + error.message); return }
    setToast('Подработка создана'); setForm(emptyForm); loadOffers(storeId)
  }

  const cancelOffer = async (id) => {
    const { error } = await supabase.from('shift_offers').update({ status: 'cancelled' }).eq('id', id)
    setToast(error ? 'Ошибка: ' + error.message : 'Отменена'); if (!error) loadOffers(storeId)
  }

  const openBookings = async (offer) => {
    setDlgOffer(offer)
    const { data } = await supabase.from('shift_bookings')
      .select('*, workers(display_name, phone)').eq('offer_id', offer.id)
    setBookings(data || [])
  }
  const setBookingStatus = async (b, status) => {
    await supabase.from('shift_bookings').update({ status }).eq('id', b.id)
    openBookings(dlgOffer)
  }

  const booked = (o) => o.shift_bookings?.[0]?.count ?? 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <EventAvailableOutlinedIcon color="primary" />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Подработка</Typography>
        <Chip label="тестовый режим" color="warning" size="small" sx={{ ml: 0.5 }} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Разовая потребность на смену. Создаёте — линейные сотрудники видят и бронируют (Telegram, следующий этап).
      </Typography>

      {myStores.length === 0 && <Alert severity="info">Нет доступных магазинов.</Alert>}

      {myStores.length > 0 && (
        <>
          <TextField
            select size="small" label="Магазин" value={storeId}
            onChange={e => setStoreId(e.target.value)} sx={{ maxWidth: 360, mb: 2 }}
          >
            {myStores.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>

          {missing && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Раздел в подготовке: выполните <b>supabase_shifts.sql</b> в этом проекте Supabase.
            </Alert>
          )}

          {!missing && (
            <>
              {/* Создание */}
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Новая подработка</Typography>
                <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="flex-start">
                  <Autocomplete
                    freeSolo size="small" options={positions} value={form.position}
                    onChange={(_, v) => setF('position', v || '')}
                    onInputChange={(_, v) => setF('position', v || '')}
                    sx={{ width: 220 }}
                    renderInput={(p) => <TextField {...p} label="Должность *" />}
                  />
                  <TextField size="small" type="date" label="Дата *" InputLabelProps={{ shrink: true }}
                    value={form.shift_date} onChange={e => setF('shift_date', e.target.value)} sx={{ width: 160 }} />
                  <TextField size="small" type="number" label="Человек" inputProps={{ min: 1 }}
                    value={form.headcount} onChange={e => setF('headcount', e.target.value)} sx={{ width: 100 }} />
                  <TextField size="small" type="time" label="С" InputLabelProps={{ shrink: true }}
                    value={form.starts_at} onChange={e => setF('starts_at', e.target.value)} sx={{ width: 110 }} />
                  <TextField size="small" type="time" label="До" InputLabelProps={{ shrink: true }}
                    value={form.ends_at} onChange={e => setF('ends_at', e.target.value)} sx={{ width: 110 }} />
                  <TextField size="small" type="number" label="Оплата, ₸/смена"
                    value={form.pay} onChange={e => setF('pay', e.target.value)} sx={{ width: 150 }} />
                  <TextField size="small" label="Тип оплаты" placeholder="переработка 1.5×"
                    value={form.pay_note} onChange={e => setF('pay_note', e.target.value)} sx={{ width: 180 }} />
                  <TextField size="small" label="Заметка" value={form.notes}
                    onChange={e => setF('notes', e.target.value)} sx={{ width: 220 }} />
                  <Button variant="contained" startIcon={<AddIcon />} onClick={create} sx={{ height: 40 }}>
                    Создать
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Оплата — информативно, расчёт через бухгалтерию сети (офлайн).
                </Typography>
              </Paper>

              {/* Список */}
              <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['Дата', 'Время', 'Должность', 'Нужно', 'Забронир.', 'Оплата', 'Статус', ''].map(h =>
                        <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {offers.length === 0 && (
                      <TableRow><TableCell colSpan={8}><Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>Подработок пока нет.</Typography></TableCell></TableRow>
                    )}
                    {offers.map(o => {
                      const [lbl, color] = statusMeta[o.status] || [o.status, 'default']
                      return (
                        <TableRow key={o.id} hover>
                          <TableCell>{o.shift_date?.split('-').reverse().join('.')}</TableCell>
                          <TableCell>{o.starts_at ? `${o.starts_at.slice(0, 5)}–${(o.ends_at || '').slice(0, 5)}` : '—'}</TableCell>
                          <TableCell>{o.position}</TableCell>
                          <TableCell>{o.headcount}</TableCell>
                          <TableCell>{booked(o)}</TableCell>
                          <TableCell>{payLabel(o)}</TableCell>
                          <TableCell><Chip size="small" label={lbl} color={color} /></TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => openBookings(o)}>Брони</Button>
                            {o.status !== 'cancelled' && (
                              <Button size="small" color="error" onClick={() => cancelOffer(o.id)}>Отменить</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Paper>
            </>
          )}
        </>
      )}

      {/* Диалог броней */}
      <Dialog open={!!dlgOffer} onClose={() => setDlgOffer(null)} fullWidth maxWidth="sm">
        <DialogTitle>Брони · {dlgOffer?.position} · {dlgOffer?.shift_date?.split('-').reverse().join('.')}</DialogTitle>
        <DialogContent dividers>
          {bookings.length === 0 && <Typography variant="body2" color="text.secondary">Пока никто не забронировал.</Typography>}
          {bookings.map(b => (
            <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">{b.workers?.display_name || 'Работник'} · код <b>{b.code}</b></Typography>
                <Typography variant="caption" color="text.secondary">{b.status}</Typography>
              </Box>
              <Button size="small" color="success" disabled={b.status === 'confirmed'} onClick={() => setBookingStatus(b, 'confirmed')}>Пришёл</Button>
              <Button size="small" color="error" disabled={b.status === 'no_show'} onClick={() => setBookingStatus(b, 'no_show')}>Неявка</Button>
            </Box>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setDlgOffer(null)}>Закрыть</Button></DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  )
}
