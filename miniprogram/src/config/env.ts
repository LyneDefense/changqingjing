const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8080/api/v1/app'

export const API_BASE_URL = process.env.TARO_APP_API_BASE_URL || DEFAULT_API_BASE_URL
