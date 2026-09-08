import { createContext, useContext } from 'react'
import type { AdminUser } from '../api/admin'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export interface AuthState {
  status: AuthStatus
  user?: AdminUser
  sessionExpired: boolean
}

export interface AuthContextValue extends AuthState {
  login: (loginName: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
