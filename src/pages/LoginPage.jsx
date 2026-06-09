import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, TextField, Button,
  Divider, Alert, CircularProgress,
} from '@mui/material'
import GitHubIcon from '@mui/icons-material/GitHub'
import CircleIcon from '@mui/icons-material/Circle'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signIn, signInWithGitHub } = useAuth()
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

  const handleGitHub = async () => {
    try {
      await signInWithGitHub()
    } catch (err) {
      setError(err.message)
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
              bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#0F1117' }}>D</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>DataPanel</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircleIcon sx={{ fontSize: 7, color: 'primary.main' }} />
              <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>supabase · rbac</Typography>
            </Box>
          </Box>
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

        <Divider sx={{ my: 2.5, fontSize: '0.75rem', color: 'text.disabled' }}>или</Divider>

        <Button
          variant="outlined"
          fullWidth
          startIcon={<GitHubIcon />}
          onClick={handleGitHub}
          sx={{ py: 1, color: 'text.primary', borderColor: 'divider' }}
        >
          Войти через GitHub
        </Button>

        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2.5, textAlign: 'center' }}>
          Роль назначается администратором в Supabase Dashboard
        </Typography>
      </Paper>
    </Box>
  )
}
