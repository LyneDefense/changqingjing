import Taro from '@tarojs/taro'
import type { AppUser } from './auth-types'

const TOKEN_STORAGE_KEY = 'changqingjing_access_token'
const USER_STORAGE_KEY = 'changqingjing_current_user'

export function getAccessToken(): string {
  return Taro.getStorageSync<string>(TOKEN_STORAGE_KEY) || ''
}

export function setAccessToken(token: string): void {
  Taro.setStorageSync(TOKEN_STORAGE_KEY, token)
}

export function clearAccessToken(): void {
  Taro.removeStorageSync(TOKEN_STORAGE_KEY)
}

export function getStoredUser(): AppUser | undefined {
  return Taro.getStorageSync<AppUser>(USER_STORAGE_KEY) || undefined
}

export function setStoredUser(user: AppUser): void {
  Taro.setStorageSync(USER_STORAGE_KEY, user)
}

export function clearStoredUser(): void {
  Taro.removeStorageSync(USER_STORAGE_KEY)
}
