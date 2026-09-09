import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegisteredAppUser } from '../api/admin'
import { UsersPage } from './UsersPage'

const user: RegisteredAppUser = {
  id: '2f3976a4-0ad8-448e-ab54-81baf5c2d391',
  displayName: '微信用户2F3976',
  maskedPhone: '138****8000',
  phoneBound: true,
  wechatBound: true,
  status: 'ACTIVE',
  registeredAt: '2026-09-09T08:00:00Z',
  lastLoginAt: '2026-09-09T09:00:00Z',
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('UsersPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/users?')) {
        return jsonResponse({ items: [user], page: 1, pageSize: 20, total: 1 })
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

  it('lists operational fields and opens a read-only detail', async () => {
    render(<UsersPage />)

    expect(await screen.findByText(user.displayName)).toBeInTheDocument()
    expect(screen.getByText(user.maskedPhone!)).toBeInTheDocument()
    expect(screen.queryByText(/openid/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /停用|删除|导出/ })).not.toBeInTheDocument()

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
    render(<UsersPage />)
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
})
