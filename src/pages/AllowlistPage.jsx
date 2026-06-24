import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Paper, Typography, Alert, Button, TextField, Stack, Checkbox,
  Table, TableBody, TableCell, TableHead, TableRow, Snackbar,
} from '@mui/material'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { supabase } from '../lib/supabase'

// «123456» => {tg_id}; «@ivan» / «ivan» => {username}
const parseEntry = (raw) => {
  const t = String(raw ?? '').trim().replace(/^@/, '')
  if (!t) return null
  if (/^\d{4,}$/.test(t)) return { tg_id: Number(t) }
  return { username: t.toLowerCase() }
}

export default function AllowlistPage() {
  const [rows, setRows] = useState([])
  const [sel, setSel] = useState(new Set())
  const [entry, setEntry] = useState('')
  const [label, setLabel] = useState('')
  const [toast, setToast] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('tg_allowlist').select('*').order('created_at', { ascending: true })
    if (!error) { setRows(data || []); setSel(new Set()) }
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    const e = parseEntry(entry)
    if (!e) { setToast('Введите Telegram ID или @username'); return }
    const { error } = await supabase.from('tg_allowlist').insert({ ...e, label: label.trim() || null })
    if (error) { setToast(error.code === '23505' ? 'Уже в списке' : 'Ошибка: ' + error.message); return }
    setEntry(''); setLabel(''); setToast('Добавлено'); load()
  }

  const removeSelected = async () => {
    if (!sel.size) return
    if (!window.confirm(`Удалить выбранные (${sel.size})?`)) return
    const { error } = await supabase.from('tg_allowlist').delete().in('id', [...sel])
    setToast(error ? 'Ошибка: ' + error.message : 'Удалено'); if (!error) load()
  }

  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))

  const importFile = async (file) => {
    if (!file) return
    try {
      let parsed = []
      if (/\.xlsx?$/i.test(file.name)) {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await file.arrayBuffer())
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false })
        parsed = aoa.map(r => ({ e: parseEntry(r[0]), label: (r[1] ?? '').toString().trim() }))
      } else {
        const text = await file.text()
        parsed = text.split(/\r?\n/).map(line => {
          const parts = line.trim().split(/[,;\t]+|\s{2,}/).filter(Boolean)
          return { e: parseEntry(parts[0]), label: (parts.slice(1).join(' ') || '').trim() }
        })
      }
      // существующие — чтобы не словить конфликт уникальности
      const haveId = new Set(rows.map(r => r.tg_id).filter(Boolean))
      const haveName = new Set(rows.map(r => r.username).filter(Boolean))
      const recs = []
      for (const { e, label } of parsed) {
        if (!e) continue
        if (e.tg_id && haveId.has(e.tg_id)) continue
        if (e.username && haveName.has(e.username)) continue
        if (e.tg_id) haveId.add(e.tg_id); if (e.username) haveName.add(e.username)
        recs.push({ ...e, label: label || null })
      }
      if (!recs.length) { setToast('Новых записей не найдено'); return }
      const { error } = await supabase.from('tg_allowlist').insert(recs)
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
        Список <b>не пуст</b> — подработки и уведомления только этим аккаунтам (по <b>ID</b> или <b>@username</b>).
        Список <b>пуст</b> — для всех. ⚠️ @username есть не у всех и может меняться — для надёжности используйте ID
        (узнать: бот <i>@userinfobot</i>).
      </Alert>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
          <TextField size="small" label="Telegram ID или @username" value={entry}
            onChange={e => setEntry(e.target.value)} sx={{ width: 230 }} />
          <TextField size="small" label="Подпись (имя)" value={label}
            onChange={e => setLabel(e.target.value)} sx={{ width: 200 }} />
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
          txt: по строке — «ID» / «@username» / «ID, Имя». xlsx: 1-й столбец ID или @username, 2-й — имя.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox size="small" checked={allChecked}
                  indeterminate={sel.size > 0 && !allChecked} onChange={toggleAll} />
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Telegram ID</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>@username</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Подпись</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Добавлен</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5}>
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                  Список пуст — подработки доступны всем. Добавьте ID/@username, чтобы ограничить.
                </Typography>
              </TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.id} hover selected={sel.has(r.id)}>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                </TableCell>
                <TableCell>{r.tg_id || '—'}</TableCell>
                <TableCell>{r.username ? '@' + r.username : '—'}</TableCell>
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
