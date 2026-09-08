import Taro from '@tarojs/taro'

const TOKEN_STORAGE_KEY = 'changqingjing_access_token'

export function getAccessToken(): string {
  return Taro.getStorageSync<string>(TOKEN_STORAGE_KEY) || ''
}

export function setAccessToken(token: string): void {
  Taro.setStorageSync(TOKEN_STORAGE_KEY, token)
}

export function clearAccessToken(): void {
  Taro.removeStorageSync(TOKEN_STORAGE_KEY)
}

export function isLoggedIn(): boolean {
  return getAccessToken().length > 0
}
