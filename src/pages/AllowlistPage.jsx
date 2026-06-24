import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Paper, Typography, Alert, Button, TextField, Stack, Checkbox, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, Snackbar, Tooltip,
} from '@mui/material'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { supabase } from '../lib/supabase'

export default function AllowlistPage() {
  const [rows, setRows] = useState([])
  const [sel, setSel] = useState(new Set())
  const [tgId, setTgId] = useState('')
  const [label, setLabel] = useState('')
  const [toast, setToast] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('tg_allowlist').select('*').order('created_at', { ascending: true })
    if (!error) { setRows(data || []); setSel(new Set()) }
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    const id = Number(String(tgId).trim())
    if (!Number.isFinite(id) || id <= 0) { setToast('Укажите числовой Telegram ID'); return }
    const { error } = await supabase.from('tg_allowlist').upsert({ tg_id: id, label: label.trim() || null })
    if (error) { setToast('Ошибка: ' + error.message); return }
    setTgId(''); setLabel(''); setToast('Добавлено'); load()
  }

  const removeSelected = async () => {
    if (!sel.size) return
    if (!window.confirm(`Удалить выбранные (${sel.size})?`)) return
    const { error } = await supabase.from('tg_allowlist').delete().in('tg_id', [...sel])
    setToast(error ? 'Ошибка: ' + error.message : 'Удалено'); if (!error) load()
  }

  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.tg_id)))

  const importFile = async (file) => {
    if (!file) return
    try {
      let entries = []
      if (/\.xlsx?$/i.test(file.name)) {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await file.arrayBuffer())
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false })
        entries = aoa.map(r => [Number(r[0]), (r[1] ?? '').toString().trim()])
      } else {
        const text = await file.text()
        entries = text.split(/\r?\n/).map(line => {
          const m = line.match(/(\d{4,})/)         // первый длинный номер = tg_id
          if (!m) return [NaN, '']
          const id = Number(m[1])
          const rest = line.replace(m[1], '').replace(/[,;\t]+/g, ' ').trim()
          return [id, rest]
        })
      }
      const recs = entries.filter(([id]) => Number.isFinite(id) && id > 0)
        .map(([tg_id, label]) => ({ tg_id, label: label || null }))
      if (!recs.length) { setToast('В файле не найдено Telegram ID'); return }
      const { error } = await supabase.from('tg_allowlist').upsert(recs, { onConflict: 'tg_id' })
      if (error) { setToast('Ошибка импорта: ' + error.message); return }
      setToast(`Импортировано: ${recs.length}`); load()
    } catch (e) {
      setToast('Ошибка чтения файла: ' + (e.message ?? e))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const allChecked = rows.length > 0 && sel.size === rows.length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <VerifiedUserOutlinedIcon color="primary" />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Белый список (Telegram)</Typography>
      </Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Если список <b>не пуст</b> — доступ к подработкам и уведомления получают <b>только</b> эти Telegram-аккаунты.
        Если список <b>пуст</b> — работает для всех. ID можно узнать у бота <i>@userinfobot</i>.
      </Alert>

      {/* Добавление + импорт */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
          <TextField size="small" label="Telegram ID" value={tgId}
            onChange={e => setTgId(e.target.value)} sx={{ width: 170 }} />
          <TextField size="small" label="Подпись (имя)" value={label}
            onChange={e => setLabel(e.target.value)} sx={{ width: 220 }} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={add}>Добавить</Button>
          <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => fileRef.current?.click()}>
            Импорт (txt / xlsx)
          </Button>
          <input ref={fileRef} type="file" accept=".txt,.csv,.xlsx,.xls" hidden
            onChange={e => importFile(e.target.files?.[0])} />
          <Box sx={{ flex: 1 }} />
          <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />}
            disabled={!sel.size} onClick={removeSelected}>
            Удалить выбранные ({sel.size})
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Формат txt: по одному в строке — «ID» или «ID, Имя». xlsx: 1-й столбец ID, 2-й — имя.
        </Typography>
      </Paper>

      {/* Таблица */}
      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox size="small" checked={allChecked}
                  indeterminate={sel.size > 0 && !allChecked} onChange={toggleAll} />
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Telegram ID</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Подпись</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Добавлен</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4}>
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                  Список пуст — подработки доступны всем. Добавьте ID, чтобы ограничить.
                </Typography>
              </TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.tg_id} hover selected={sel.has(r.tg_id)}>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={sel.has(r.tg_id)} onChange={() => toggle(r.tg_id)} />
                </TableCell>
                <TableCell>{r.tg_id}</TableCell>
                <TableCell>{r.label || '—'}</TableCell>
                <TableCell>{r.created_at ? new Date(r.created_at).toLocaleDateString('ru-RU') : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  )
}
