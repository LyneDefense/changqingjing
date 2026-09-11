import Taro from '@tarojs/taro'
import {
  AuthApiError,
  fetchCurrentUser,
  registerWechatUser,
  revokeAppSession,
  restoreWechatSession
} from './auth-api'
import type { AppLoginResult, AuthSnapshot } from './auth-types'
import {
  clearAccessToken,
  clearStoredUser,
  getAccessToken,
  getStoredUser,
  setAccessToken,
  setStoredUser
} from './session'

type Listener = () => void

const listeners = new Set<Listener>()
const storedUser = getStoredUser()
let snapshot: AuthSnapshot = getAccessToken() && storedUser
  ? { status: 'authenticated', user: storedUser }
  : { status: 'guest' }
let recoveryPromise: Promise<boolean> | undefined

function publish(next: AuthSnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

function acceptLogin(result: AppLoginResult) {
  setAccessToken(result.accessToken)
  setStoredUser(result.user)
  publish({ status: 'authenticated', user: result.user })
  return result.user
}

function becomeGuest(clearToken = true) {
  if (clearToken) clearAccessToken()
  clearStoredUser()
  publish({ status: 'guest' })
}

async function freshLoginCode(): Promise<string> {
  const result = await Taro.login({ timeout: 8000 })
  if (!result.code) throw new Error('微信登录凭证获取失败，请稍后重试')
  return result.code
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot
}

export function isLoggedIn(): boolean {
  return snapshot.status === 'authenticated' && Boolean(getAccessToken())
}

export async function initializeAuth(): Promise<void> {
  const token = getAccessToken()
  if (!token) {
    becomeGuest()
    return
  }
  publish({ status: 'initializing', user: getStoredUser() })
  try {
    const user = await fetchCurrentUser(token)
    setStoredUser(user)
    publish({ status: 'authenticated', user })
  } catch (error) {
    if (error instanceof AuthApiError && error.statusCode === 401) {
      clearAccessToken()
      await recoverRegisteredSession()
      return
    }
    publish({ status: 'guest' })
  }
}

export async function registerWithPhoneCode(phoneCode: string) {
  const loginCode = await freshLoginCode()
  const result = await registerWechatUser(loginCode, phoneCode)
  return acceptLogin(result)
}

export function recoverRegisteredSession(): Promise<boolean> {
  if (recoveryPromise) return recoveryPromise
  recoveryPromise = (async () => {
    try {
      const loginCode = await freshLoginCode()
      const result = await restoreWechatSession(loginCode)
      acceptLogin(result)
      return true
    } catch (error) {
      if (error instanceof AuthApiError
          && (error.code === 'REGISTRATION_REQUIRED' || error.statusCode === 401)) {
        becomeGuest()
      } else {
        publish({ status: 'guest' })
      }
      return false
    } finally {
      recoveryPromise = undefined
    }
  })()
  return recoveryPromise
}

export function clearLogin(): void {
  becomeGuest()
}

export async function logoutCurrentUser(): Promise<void> {
  const token = getAccessToken()
  try {
    if (token) await revokeAppSession(token)
  } finally {
    becomeGuest()
  }
}

export { getAccessToken } from './session'
export type { AppUser, AuthSnapshot } from './auth-types'
