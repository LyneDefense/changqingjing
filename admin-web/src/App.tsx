import { Outlet, useNavigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './auth/authContextValue'
import { Sidebar } from './components/Sidebar'

export function App() {
  const auth = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <Sidebar />
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">常清净文旅投</p>
            <h1>运营管理后台</h1>
          </div>
          <div className="header-actions">
            <span className="current-user">
              {auth.user?.displayName}
              <small>{auth.user?.role === 'ADMIN' ? '管理员' : '运营'}</small>
            </span>
            <button className="text-button" onClick={() => void handleLogout()} type="button">
              退出
            </button>
          </div>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
