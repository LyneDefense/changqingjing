const ADMIN_API_BASE = '/api/v1/admin'

interface ApiResponse<T> {
  data: T
}

interface ApiErrorBody {
  code?: string
  message?: string
  traceId?: string
}

interface CsrfToken {
  headerName: string
  parameterName: string
  token: string
}

export interface AdminUser {
  id: string
  loginName: string
  displayName: string
  role: 'ADMIN' | 'OPERATOR'
  permissions: string[]
}

export class AdminApiError extends Error {
  readonly status: number
  readonly code: string
  readonly traceId?: string

  constructor(
    status: number,
    code: string,
    message: string,
    traceId?: string,
  ) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
    this.traceId = traceId
  }
}

let csrfToken: CsrfToken | undefined

function emitSessionExpired() {
  window.dispatchEvent(new Event('admin-session-expired'))
}

async function parseError(response: Response) {
  let body: ApiErrorBody = {}
  try {
    body = (await response.json()) as ApiErrorBody
  } catch {
    // Non-JSON gateway failures still become a consistent client error.
  }
  return new AdminApiError(
    response.status,
    body.code ?? 'REQUEST_FAILED',
    body.message ?? '请求失败，请稍后重试',
    body.traceId,
  )
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  notifyUnauthorized = true,
): Promise<T> {
  const response = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const error = await parseError(response)
    if (response.status === 401 && notifyUnauthorized) {
      csrfToken = undefined
      emitSessionExpired()
    }
    throw error
  }
  const responseBody = (await response.json()) as ApiResponse<T>
  return responseBody.data
}

export async function refreshCsrfToken() {
  csrfToken = await request<CsrfToken>('/auth/csrf', {}, false)
  return csrfToken
}

async function writeRequest<T>(path: string, init: RequestInit, notifyUnauthorized = true) {
  const currentToken = csrfToken ?? (await refreshCsrfToken())
  return request<T>(
    path,
    {
      ...init,
      headers: {
        ...init.headers,
        [currentToken.headerName]: currentToken.token,
      },
    },
    notifyUnauthorized,
  )
}

export function getCurrentAdmin() {
  return request<AdminUser>('/auth/me', {}, false)
}

export function loginAdmin(loginName: string, password: string) {
  return writeRequest<AdminUser>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ loginName, password }),
    },
    false,
  )
}

export async function logoutAdmin() {
  try {
    await writeRequest<string>('/auth/logout', { method: 'POST' })
  } finally {
    csrfToken = undefined
  }
}

export const adminApi = {
  request,
  writeRequest,
}

export function resetAdminApiForTests() {
  csrfToken = undefined
}
