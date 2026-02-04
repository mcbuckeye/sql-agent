import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, useAppStore } from './lib/store'
import { authApi } from './lib/api'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { ConnectionsPage } from './pages/Connections'
import { QueryPage } from './pages/Query'
import { HistoryPage } from './pages/History'

function App() {
  const { token, setAuth, clearAuth } = useAuthStore()
  const { darkMode } = useAppStore()

  // Apply dark mode on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Validate token on mount
  useEffect(() => {
    if (token) {
      authApi.me()
        .then(user => setAuth(user, token))
        .catch(() => clearAuth())
    }
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/connections" element={<ConnectionsPage />} />
                <Route path="/query" element={<QueryPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
