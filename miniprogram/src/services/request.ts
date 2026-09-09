import Taro from '@tarojs/taro'
import { API_BASE_URL } from '../config/env'
import { recoverRegisteredSession } from './auth'
import { getAccessToken } from './session'

interface ApiResponse<T> {
  data: T
}

interface ApiErrorResponse {
  code?: string
  message?: string
  traceId?: string
}

interface RequestOptions<TData> {
  path: string
  method?: keyof Taro.request.Method
  data?: TData
}

export class ApiRequestError extends Error {
  statusCode: number
  code: string
  traceId?: string

  constructor(statusCode: number, code: string, message: string, traceId?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.statusCode = statusCode
    this.code = code
    this.traceId = traceId
  }
}

export async function request<TResponse, TData = unknown>(
  options: RequestOptions<TData>
): Promise<TResponse> {
  return executeRequest(options, true)
}

async function executeRequest<TResponse, TData = unknown>(
  options: RequestOptions<TData>,
  allowRecovery: boolean
): Promise<TResponse> {
  const token = getAccessToken()
  const response = await Taro.request<ApiResponse<TResponse> | ApiErrorResponse>({
    url: `${API_BASE_URL}${options.path}`,
    method: options.method || 'GET',
    data: options.data,
    header: token ? { Authorization: `Bearer ${token}` } : {}
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const error = response.data as ApiErrorResponse
    if (response.statusCode === 401
        && allowRecovery
        && Boolean(token)
        && (options.method === undefined || options.method === 'GET')
        && await recoverRegisteredSession()) {
      return executeRequest(options, false)
    }
    throw new ApiRequestError(
      response.statusCode,
      error.code || 'REQUEST_FAILED',
      error.message || '网络开小差了，请稍后重试',
      error.traceId
    )
  }

  return (response.data as ApiResponse<TResponse>).data
}
