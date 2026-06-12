import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, TextField, Button,
  Alert, CircularProgress,
} from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn({ email, password })
      navigate('/')
    } catch (err) {
      setError(err.message ?? 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }


  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper sx={{ width: '100%', maxWidth: 380, p: 4 }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 3.5 }}>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: 1.5,
              bgcolor: 'error.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Т</Typography>
          </Box>
          <Typography sx={{ fontSize: 16, fontWeight: 600 }}>Toimart</Typography>
        </Box>

        <Typography variant="h5" sx={{ mb: 0.5, fontSize: '1.15rem' }}>Войти в систему</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Роль определяет доступные разделы и операции
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            fullWidth
            autoComplete="email"
          />
          <TextField
            label="Пароль"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="current-password"
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{ py: 1.1 }}
          >
            {loading ? <CircularProgress size={18} sx={{ color: '#0F1117' }} /> : 'Войти'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
