import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, FormControlLabel, Switch, Divider,
  Alert, CircularProgress, Chip, Grid,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/rbac'
import { useProducts } from '../hooks/useProducts'
import RoleGuard from '../components/RoleGuard'

const EMPTY = {
  name: '', sku: '', category: 'Electronics', price: '',
  stock: '', status: 'active', description: '',
  is_featured: false, supplier: '', internal_code: '',
}

export default function ProductFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { role } = useAuth()
  const { rows, create, update } = useProducts()

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = isEdit ? can(role, 'canEdit') : can(role, 'canCreate')

  useEffect(() => {
    if (isEdit) {
      const record = rows.find(r => String(r.id) === id)
      if (record) setForm({ ...EMPTY, ...record })
    }
  }, [id, rows, isEdit])

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        price: form.price === '' ? null : Number(form.price),
        stock: form.stock === '' ? null : Number(form.stock),
      }
      if (isEdit) {
        await update(Number(id), payload)
      } else {
        await create(payload)
      }
      navigate('/products')
    } catch (err) {
      setError(err.message ?? 'Ошибка при сохранении')
    } finally {
      setLoading(false)
    }
  }

  const permission = isEdit ? 'canEdit' : 'canCreate'

  return (
    <RoleGuard permission={permission}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/products')}
            variant="outlined"
            size="small"
            sx={{ color: 'text.secondary', borderColor: 'divider' }}
          >
            Назад
          </Button>
          <Box>
            <Typography variant="h5">{isEdit ? 'Редактировать товар' : 'Новый товар'}</Typography>
            <Typography variant="body2" color="text.secondary">
              products · Supabase {isEdit ? 'UPDATE' : 'INSERT'}
            </Typography>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          {/* Основные данные */}
          <Paper sx={{ mb: 2 }}>
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontSize: '0.9rem' }}>Основные данные</Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField label="Название" value={form.name} onChange={set('name')} required fullWidth />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Артикул (SKU)"
                    value={form.sku}
                    onChange={set('sku')}
                    fullWidth
                    inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Категория</InputLabel>
                    <Select value={form.category} onChange={set('category')} label="Категория">
                      {['Electronics', 'Accessories', 'Software', 'Services'].map(c => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField label="Цена (₽)" type="number" value={form.price} onChange={set('price')} fullWidth inputProps={{ min: 0 }} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField label="Остаток" type="number" value={form.stock} onChange={set('stock')} fullWidth inputProps={{ min: 0 }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Статус</InputLabel>
                    <Select value={form.status} onChange={set('status')} label="Статус">
                      <MenuItem value="active">В наличии</MenuItem>
                      <MenuItem value="inactive">Нет в наличии</MenuItem>
                      <MenuItem value="order_only">Под заказ</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Описание"
                    value={form.description}
                    onChange={set('description')}
                    multiline
                    minRows={3}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch checked={form.is_featured} onChange={set('is_featured')} color="primary" />}
                    label={<Typography variant="body2">Хит продаж</Typography>}
                  />
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Admin-only блок */}
          {can(role, 'canViewAdminFields') && (
            <Paper sx={{ mb: 2 }}>
              <Box
                sx={{
                  px: 2.5, py: 1.75,
                  borderBottom: '1px solid', borderColor: 'divider',
                  display: 'flex', alignItems: 'center', gap: 1,
                  bgcolor: 'rgba(251,191,36,0.04)',
                }}
              >
                <Typography variant="h6" sx={{ fontSize: '0.9rem' }}>Только для Admin</Typography>
                <Chip label="admin" color="warning" size="small" sx={{ height: 18, fontSize: '0.68rem' }} />
              </Box>
              <Box sx={{ p: 2.5 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Внутренний код"
                      value={form.internal_code}
                      onChange={set('internal_code')}
                      fullWidth
                      inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Поставщик" value={form.supplier} onChange={set('supplier')} fullWidth />
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          )}

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={() => navigate('/products')} sx={{ color: 'text.secondary', borderColor: 'divider' }}>
              Отмена
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !canSubmit}
              startIcon={loading ? <CircularProgress size={16} sx={{ color: '#0F1117' }} /> : <SaveOutlinedIcon />}
            >
              {isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </Box>
        </Box>
      </Box>
    </RoleGuard>
  )
}
