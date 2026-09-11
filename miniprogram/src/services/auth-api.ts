import Taro from '@tarojs/taro'
import { API_BASE_URL } from '../config/env'
import type { AppLoginResult, AppUser } from './auth-types'

interface ApiResponse<T> {
  data: T
}

interface ApiErrorBody {
  code?: string
  message?: string
  traceId?: string
}

export class AuthApiError extends Error {
  statusCode: number
  code: string
  traceId?: string

  constructor(statusCode: number, code: string, message: string, traceId?: string) {
    super(message)
    this.name = 'AuthApiError'
    this.statusCode = statusCode
    this.code = code
    this.traceId = traceId
  }
}

async function authRequest<TResponse>(
  path: string,
  data: Record<string, string> | undefined,
  token?: string,
  method?: 'GET' | 'POST' | 'PATCH'
): Promise<TResponse> {
  const response = await Taro.request<ApiResponse<TResponse> | ApiErrorBody>({
    url: `${API_BASE_URL}${path}`,
    method: method ?? (data ? 'POST' : 'GET'),
    data,
    header: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const body = response.data as ApiErrorBody
    throw new AuthApiError(
      response.statusCode,
      body.code || 'REQUEST_FAILED',
      body.message || '登录服务暂时不可用，请稍后重试',
      body.traceId
    )
  }
  return (response.data as ApiResponse<TResponse>).data
}

function uploadResponse<TResponse>(statusCode: number, responseData: string): TResponse {
  let body: ApiResponse<TResponse> | ApiErrorBody
  try {
    body = JSON.parse(responseData) as ApiResponse<TResponse> | ApiErrorBody
  } catch {
    throw new AuthApiError(statusCode, 'REQUEST_FAILED', '头像上传失败，请稍后重试')
  }
  if (statusCode < 200 || statusCode >= 300) {
    const error = body as ApiErrorBody
    throw new AuthApiError(
      statusCode,
      error.code || 'REQUEST_FAILED',
      error.message || '头像上传失败，请稍后重试',
      error.traceId
    )
  }
  return (body as ApiResponse<TResponse>).data
}

export function fetchCurrentUser(token: string): Promise<AppUser> {
  return authRequest<AppUser>('/me', undefined, token)
}

export function restoreWechatSession(loginCode: string): Promise<AppLoginResult> {
  return authRequest<AppLoginResult>('/auth/wechat/session', { loginCode })
}

export function registerWechatUser(
  loginCode: string,
  phoneCode: string
): Promise<AppLoginResult> {
  return authRequest<AppLoginResult>('/auth/wechat/register-login', {
    loginCode,
    phoneCode
  })
}

export function revokeAppSession(token: string): Promise<string> {
  return authRequest<string>('/auth/logout', {}, token)
}

export function updateAppProfile(token: string, displayName?: string): Promise<AppUser> {
  return authRequest<AppUser>(
    '/me/profile',
    displayName ? { displayName } : {},
    token,
    'PATCH'
  )
}

export function skipAppProfileSetup(token: string): Promise<AppUser> {
  return authRequest<AppUser>('/me/profile/skip', {}, token)
}

export async function uploadAppAvatar(token: string, filePath: string): Promise<AppUser> {
  const response = await Taro.uploadFile({
    url: `${API_BASE_URL}/me/avatar`,
    filePath,
    name: 'avatar',
    header: { Authorization: `Bearer ${token}` }
  })
  return uploadResponse<AppUser>(response.statusCode, response.data)
}
