import Taro from '@tarojs/taro'
import { API_BASE_URL } from '../config/env'
import { getAccessToken } from './auth'

interface ApiResponse<T> {
  data: T
}

interface RequestOptions<TData> {
  path: string
  method?: keyof Taro.request.Method
  data?: TData
}

export async function request<TResponse, TData = unknown>(
  options: RequestOptions<TData>
): Promise<TResponse> {
  const token = getAccessToken()
  const response = await Taro.request<ApiResponse<TResponse>>({
    url: `${API_BASE_URL}${options.path}`,
    method: options.method || 'GET',
    data: options.data,
    header: token ? { Authorization: `Bearer ${token}` } : {}
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`请求失败：${response.statusCode}`)
  }

  return response.data.data
}
