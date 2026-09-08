import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { useAuth } from './authContextValue'

export function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return <main className="centered-state">正在确认登录状态…</main>
  }
  if (auth.status === 'error') {
    return (
      <main className="centered-state error-state">
        <h1>暂时无法连接管理服务</h1>
        <p>请检查网络后重试。</p>
        <button className="primary-button" onClick={() => void auth.refresh()} type="button">
          重新连接
        </button>
      </main>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }
  return <Outlet />
}

export function PermissionRoute({ permission }: { permission: string }) {
  const auth = useAuth()
  if (!auth.hasPermission(permission)) {
    return <Navigate replace to="/forbidden" />
  }
  return <Outlet />
}

export function AdminOnlyRoute() {
  return <PermissionRoute permission="staff:manage" />
}
