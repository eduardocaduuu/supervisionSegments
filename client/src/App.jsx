import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from './utils/api'

// Pages
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import AdminLogin from './pages/AdminLogin'
import AdminPanel from './pages/AdminPanel'

function App() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      await api.checkAuth()
      setIsAdmin(true)
    } catch {
      setIsAdmin(false)
    } finally {
      setCheckingAuth(false)
    }
  }

  const handleLogout = async () => {
    try {
      await api.logout()
      setIsAdmin(false)
      navigate('/')
    } catch (err) {
      console.error('Erro ao fazer logout:', err)
    }
  }

  const handleLoginSuccess = () => {
    setIsAdmin(true)
    navigate('/admin')
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="header-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: '1.75rem' }}>*</span>
            <h1>SuperVisao</h1>
          </Link>

          <nav className="header-nav">
            <Link to="/">Inicio</Link>
            {isAdmin ? (
              <>
                <Link to="/admin">Admin</Link>
                <button
                  onClick={handleLogout}
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: '0.5rem' }}
                >
                  Sair
                </button>
              </>
            ) : (
              <Link to="/login">Admin</Link>
            )}
          </nav>
        </div>
      </header>

      <main className="main-content">
        {checkingAuth ? (
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard/:setorId" element={<Dashboard />} />
            <Route
              path="/login"
              element={
                isAdmin ? (
                  <AdminPanel />
                ) : (
                  <AdminLogin onLoginSuccess={handleLoginSuccess} />
                )
              }
            />
            <Route
              path="/admin"
              element={
                isAdmin ? (
                  <AdminPanel />
                ) : (
                  <AdminLogin onLoginSuccess={handleLoginSuccess} />
                )
              }
            />
          </Routes>
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '1rem',
        color: 'var(--gray-500)',
        fontSize: '0.875rem'
      }}>
        SuperVisao - Sistema de Gestao de Metas
      </footer>
    </div>
  )
}

export default App
