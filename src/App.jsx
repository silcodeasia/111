import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from './context/AuthContext'
import { can } from './lib/rbac'
import AppLayout from './components/AppLayout'

// Страницы грузятся лениво — каждая попадает в свой чанк и подтягивается
// только при переходе на маршрут (особенно важно для страниц с DataGrid).
const LoginPage = lazy(() => import('./pages/LoginPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const StoresPage = lazy(() => import('./pages/StoresPage'))
const PlanPage = lazy(() => import('./pages/PlanPage'))
const StaffingPage = lazy(() => import('./pages/StaffingPage'))
const RmPage = lazy(() => import('./pages/RmPage'))
const HrPage = lazy(() => import('./pages/HrPage'))
const ShiftsPage = lazy(() => import('./pages/ShiftsPage'))

/** Центрированный спиннер — общий фолбэк для загрузки */
function FullscreenLoader() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CircularProgress sx={{ color: 'primary.main' }} />
    </Box>
  )
}

/** Маршрут, требующий аутентификации */
function PrivateRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) return <FullscreenLoader />

  if (!session) return <Navigate to="/login" replace />

  return <AppLayout>{children}</AppLayout>
}

// Первая доступная роли страница (вместо удалённой «Панели»)
const HOME_ORDER = [
  ['/plan', 'canViewPlan'],
  ['/staffing', 'canManageStaffing'],
  ['/rm', 'canViewRegion'],
  ['/stores', 'canViewStores'],
  ['/hr', 'canManageHr'],
  ['/users', 'canViewUsers'],
]
function Home() {
  const { session, loading, role } = useAuth()
  if (loading) return <FullscreenLoader />
  if (!session) return <Navigate to="/login" replace />
  const target = HOME_ORDER.find(([, p]) => can(role, p))?.[0] ?? '/users'
  return <Navigate to={target} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullscreenLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={<Home />} />
          <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
          <Route path="/stores" element={<PrivateRoute><StoresPage /></PrivateRoute>} />
          <Route path="/plan" element={<PrivateRoute><PlanPage /></PrivateRoute>} />
          <Route path="/staffing" element={<PrivateRoute><StaffingPage /></PrivateRoute>} />
          <Route path="/rm" element={<PrivateRoute><RmPage /></PrivateRoute>} />
          <Route path="/shifts" element={<PrivateRoute><ShiftsPage /></PrivateRoute>} />
          <Route path="/hr" element={<PrivateRoute><HrPage /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
