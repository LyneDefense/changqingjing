import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AdminApiError,
  getCurrentAdmin,
  loginAdmin,
  logoutAdmin,
} from '../api/admin'
import { AuthContext } from './authContextValue'
import type { AuthContextValue, AuthState } from './authContextValue'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    status: 'loading',
    sessionExpired: false,
  })

  async function loadCurrentAdmin() {
    try {
      const user = await getCurrentAdmin()
      setAuth({ status: 'authenticated', user, sessionExpired: false })
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        setAuth({ status: 'anonymous', sessionExpired: false })
        return
      }
      setAuth({ status: 'error', sessionExpired: false })
    }
  }

  async function refresh() {
    setAuth((current) => ({ ...current, status: 'loading' }))
    await loadCurrentAdmin()
  }

  useEffect(() => {
    // Initial session discovery is the effect's synchronization target.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadCurrentAdmin()
  }, [])

  useEffect(() => {
    const handleSessionExpired = () => {
      // Synchronize authentication state with API responses received outside this provider.
      // oxlint-disable-next-line react/set-state-in-effect
      setAuth((current) => ({
        status: 'anonymous',
        sessionExpired: current.status === 'authenticated' || current.sessionExpired,
      }))
    }
    window.addEventListener('admin-session-expired', handleSessionExpired)
    return () => window.removeEventListener('admin-session-expired', handleSessionExpired)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      async login(loginName, password) {
        const user = await loginAdmin(loginName, password)
        setAuth({ status: 'authenticated', user, sessionExpired: false })
      },
      async logout() {
        try {
          await logoutAdmin()
        } finally {
          setAuth({ status: 'anonymous', sessionExpired: false })
        }
      },
      refresh,
      hasPermission(permission) {
        return auth.user?.permissions.includes(permission) ?? false
      },
    }),
    [auth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
