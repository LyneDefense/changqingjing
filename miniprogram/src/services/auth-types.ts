export interface AppUser {
  id: string
  displayName: string
  avatarUrl?: string
  profileSetupRequired: boolean
  maskedPhone?: string
  phoneBound: boolean
  status: 'ACTIVE' | 'DISABLED'
  registeredAt: string
  lastLoginAt?: string
}

export interface AppLoginResult {
  accessToken: string
  expiresAt: string
  user: AppUser
}

export type AuthStatus = 'initializing' | 'guest' | 'authenticated'

export interface AuthSnapshot {
  status: AuthStatus
  user?: AppUser
}
