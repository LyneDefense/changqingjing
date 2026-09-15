import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegisteredAppUser } from '../api/admin'
import { UsersPage } from './UsersPage'
import { resetAdminApiForTests } from '../api/admin'
import { AuthContext } from '../auth/authContextValue'
import type { AuthContextValue } from '../auth/authContextValue'

const user: RegisteredAppUser = {
  id: '2f3976a4-0ad8-448e-ab54-81baf5c2d391',
  displayName: '微信用户2F3976',
  maskedPhone: '138****8000',
  phoneBound: true,
  wechatBound: true,
  status: 'ACTIVE',
  registeredAt: '2026-09-09T08:00:00Z',
  lastLoginAt: '2026-09-09T09:00:00Z',
  version: 0,
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('UsersPage', () => {
  let fetchMock: ReturnType<typeof vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>>
  let users: RegisteredAppUser[]

  function renderUsers(permissions = ['user:read', 'user:manage']) {
    const auth: AuthContextValue = {
      status: 'authenticated', sessionExpired: false,
      login: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
      hasPermission: (permission) => permissions.includes(permission),
    }
    return render(<AuthContext.Provider value={auth}><UsersPage /></AuthContext.Provider>)
  }

  beforeEach(() => {
    resetAdminApiForTests()
    users = [{ ...user }]
    fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/auth/csrf')) return jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'users-csrf', parameterName: '_csrf' })
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body))
        users[0] = { ...users[0], status: body.status, version: users[0].version + 1 }
        return jsonResponse(users[0])
      }
      if (init?.method === 'DELETE') {
        users = []
        return jsonResponse('deleted')
      }
      if (url.includes('/users?')) {
        return jsonResponse({ items: users, page: 1, pageSize: 20, total: users.length })
      }
      if (url.endsWith(`/users/${user.id}`)) return jsonResponse(user)
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('lists masked fields and opens detail without exposing credentials', async () => {
    renderUsers()

    expect(await screen.findByText(user.displayName)).toBeInTheDocument()
    expect(screen.getByText(user.maskedPhone!)).toBeInTheDocument()
    expect(screen.queryByText(/openid/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /导出/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(within(dialog).queryByText('正在加载详情…')).not.toBeInTheDocument()
    })
    expect(within(dialog).getByText('已绑定')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/users/${user.id}`),
      expect.anything(),
    )
  })

  it('passes plain-language filters to the list endpoint', async () => {
    renderUsers()
    await screen.findByText(user.displayName)

    fireEvent.change(screen.getByLabelText('用户状态'), { target: { value: 'ACTIVE' } })
    fireEvent.change(screen.getByLabelText('手机号绑定状态'), { target: { value: 'true' } })
    fireEvent.change(screen.getByLabelText('搜索用户'), { target: { value: '2F3976' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索' }))

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => {
        const value = String(url)
        return value.includes('status=ACTIVE')
          && value.includes('phoneBound=true')
          && value.includes('keyword=2F3976')
      })).toBe(true)
    })
  })

  it('requires confirmation for freezing, then supports unfreezing with the latest version', async () => {
    renderUsers()
    await screen.findByText(user.displayName)
    fireEvent.click(screen.getByRole('button', { name: '冻结' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('所有登录立即失效')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '冻结' }))
    fireEvent.click(screen.getByRole('button', { name: '确认冻结' }))
    await screen.findByRole('button', { name: '解冻' })
    expect(screen.getByRole('status')).toHaveTextContent('用户已冻结')
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(call[1]?.headers).toEqual(expect.objectContaining({ 'X-CSRF-TOKEN': 'users-csrf' }))
    expect(JSON.parse(String(call[1]?.body))).toEqual({ status: 'DISABLED', expectedVersion: 0 })
    fireEvent.click(screen.getByRole('button', { name: '解冻' }))
    fireEvent.click(screen.getByRole('button', { name: '确认解冻' }))
    await screen.findByRole('button', { name: '冻结' })
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(writes[1][1]?.body))).toEqual({ status: 'ACTIVE', expectedVersion: 1 })
  })

  it('deletes only after explicit confirmation, sends CSRF and refreshes the empty list', async () => {
    renderUsers()
    await screen.findByText(user.displayName)
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('此操作无法撤销')
    expect(dialog).toHaveTextContent('以后仍可重新授权注册')
    expect(within(dialog).getByText(user.maskedPhone!)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
    fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }))
    await screen.findByText('没有符合条件的注册用户。')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')!
    expect(String(call[0])).toContain(`/users/${user.id}?expectedVersion=0`)
    expect(call[1]?.headers).toEqual(expect.objectContaining({ 'X-CSRF-TOKEN': 'users-csrf' }))
  })

  it('does not display write actions without management permission', async () => {
    renderUsers(['user:read'])
    await screen.findByText(user.displayName)
    expect(screen.queryByRole('button', { name: /冻结|解冻|删除/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看详情' })).toBeEnabled()
  })

  it('returns to the previous page when deleting the last user on the last page', async () => {
    users = Array.from({ length: 21 }, (_, index) => ({
      ...user,
      id: `2f3976a4-0ad8-448e-ab54-${String(index).padStart(12, '0')}`,
      displayName: `测试用户${index}`,
    }))
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname.endsWith('/users') && !init?.method) {
        const current = Number(url.searchParams.get('page'))
        return jsonResponse({ items: users.slice((current - 1) * 20, current * 20), page: current, pageSize: 20, total: users.length })
      }
      if (init?.method === 'DELETE') {
        users = users.filter((entry) => !url.pathname.endsWith(entry.id))
        return jsonResponse('deleted')
      }
      return original(input, init)
    })
    renderUsers()
    await screen.findByText('测试用户0')
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await screen.findByText('测试用户20')
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    await screen.findByText('第 1 / 1 页，共 20 位用户')
    expect(await screen.findByText('测试用户0')).toBeInTheDocument()
    expect(screen.queryByText('测试用户20')).not.toBeInTheDocument()
  })

  it('closes stale confirmation and refreshes before the administrator can reconfirm', async () => {
    renderUsers()
    await screen.findByText(user.displayName)
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === 'DELETE') {
        users[0] = { ...users[0], version: 1, status: 'DISABLED' }
        return new Response(JSON.stringify({ code: 'APP_USER_VERSION_CONFLICT', message: '用户信息已变化，请刷新列表并重新确认后操作' }), { status: 409 })
      }
      return original(input, init)
    })
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('alert')).toHaveTextContent('用户信息已变化')
    expect(screen.getByRole('button', { name: '解冻' })).toBeEnabled()
  })

  it('keeps failed operations visible and prevents duplicate submissions while waiting', async () => {
    let complete: ((response: Response) => void) | undefined
    renderUsers()
    await screen.findByText(user.displayName)
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === 'DELETE') return new Promise<Response>((resolve) => { complete = resolve })
      return original(input, init)
    })
    const confirm = screen.getByRole('button', { name: '确认删除' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await waitFor(() => expect(complete).toBeDefined())
    expect(screen.getByRole('button', { name: '正在处理…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    complete!(new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: '服务暂时不可用', traceId: 'test-trace' }), { status: 500 }))
    expect(await screen.findByRole('alert')).toHaveTextContent('服务暂时不可用（追踪号：test-trace）')
    expect(screen.getByRole('button', { name: '确认删除' })).toBeEnabled()
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
