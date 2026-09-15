import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import './Mobile.css'
import { useAuth } from './auth/authContextValue'
import { Sidebar } from './components/Sidebar'
import { findAdminModule } from './config/adminModules'
import { useMobileLayout } from './hooks/useMobileLayout'

export function App() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const mobile = useMobileLayout()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const drawerOpen = mobile && menuOpen

  useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const drawer = document.getElementById('admin-navigation')
    const focusFrame = window.requestAnimationFrame(() => drawer?.querySelector<HTMLButtonElement>('button')?.focus())
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
      }
      if (event.key === 'Tab') {
        const targets = Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [])
        const first = targets[0]
        const last = targets[targets.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    const trigger = menuButton.current
    return () => {
      document.body.style.overflow = previousOverflow
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKey)
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus()
    }
  }, [drawerOpen])

  const page = findAdminModule(location.pathname) ?? { group: '管理中心', label: '页面' }

  async function handleLogout() {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <Sidebar mobile={mobile} open={drawerOpen} onClose={() => setMenuOpen(false)} />
      {drawerOpen && <button aria-label="关闭菜单遮罩" className="mobile-nav-backdrop" onClick={() => setMenuOpen(false)} tabIndex={-1} type="button" />}
      <main className="admin-main" inert={drawerOpen}>
        <header className="admin-header">
          <button
            aria-controls="admin-navigation" aria-expanded={drawerOpen} aria-label="打开管理菜单"
            className="mobile-menu-button" onClick={() => setMenuOpen(true)} ref={menuButton} type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="admin-breadcrumb" aria-label="当前位置">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m4 11 8-7 8 7v9h-6v-5h-4v5H4z" />
            </svg>
            <span>{page.group}</span>
            <i>/</i>
            <strong>{page.label}</strong>
          </div>
          <div className="header-actions">
            <span className="header-divider" />
            <span className="current-user__avatar" aria-hidden="true">
              {auth.user?.displayName?.slice(0, 1) || '常'}
            </span>
            <span className="current-user">
              <strong>{auth.user?.displayName}</strong>
              <small>{auth.user?.role === 'ADMIN' ? '管理员' : '运营人员'}</small>
            </span>
            <button aria-label="退出登录" className="header-logout" onClick={() => void handleLogout()} type="button">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9" />
              </svg>
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
