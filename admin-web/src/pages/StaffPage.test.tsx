import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAdminApiForTests } from '../api/admin'
import type { AdminStaff } from '../api/admin'
import { StaffPage } from './StaffPage'

const initialStaff: AdminStaff = {
  id: '5be477df-6394-4037-aa38-d2b901f5eaf4',
  loginName: 'first.admin',
  displayName: '初始管理员',
  role: 'ADMIN',
  status: 'ACTIVE',
  lastLoginAt: '2026-09-08T08:00:00Z',
  createdAt: '2026-09-08T07:00:00Z',
  updatedAt: '2026-09-08T08:00:00Z',
  version: 0,
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('StaffPage', () => {
  let staff: AdminStaff[]
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetAdminApiForTests()
    staff = [{ ...initialStaff }]
    fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.endsWith('/auth/csrf')) {
        return jsonResponse({
          headerName: 'X-CSRF-TOKEN',
          parameterName: '_csrf',
          token: 'staff-csrf',
        })
      }
      if (url.includes('/staff?')) {
        return jsonResponse({ items: staff, page: 1, pageSize: 20, total: staff.length })
      }
      if (url.endsWith('/staff') && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as Record<string, string>
        staff.push({
          ...initialStaff,
          id: '6b9db29f-7025-4ab7-9b76-01d753ca3672',
          loginName: body.loginName,
          displayName: body.displayName,
          role: body.role as AdminStaff['role'],
        })
        return jsonResponse(staff.at(-1))
      }
      if (url.includes('/reset-password') && method === 'POST') {
        staff[0] = { ...staff[0], version: staff[0].version + 1 }
        return jsonResponse(staff[0])
      }
      if (url.includes('/staff/') && method === 'PATCH') {
        const body = JSON.parse(String(init?.body)) as Partial<AdminStaff>
        staff[0] = { ...staff[0], ...body, version: staff[0].version + 1 }
        return jsonResponse(staff[0])
      }
      throw new Error(`Unexpected request: ${method} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('lists staff and creates a new account through a CSRF-protected write', async () => {
    render(<StaffPage />)
    expect(await screen.findByText('初始管理员')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '新增人员' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('登录账号'), {
      target: { value: 'content.operator' },
    })
    fireEvent.change(within(dialog).getByLabelText('显示姓名'), {
      target: { value: '内容运营' },
    })
    fireEvent.change(within(dialog).getByLabelText(/^初始密码/), {
      target: { value: 'OperatorPassword2026' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

    expect(await screen.findByText('内容运营')).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/staff') && init?.method === 'POST',
    )
    expect(createCall?.[1]?.headers).toEqual(
      expect.objectContaining({ 'X-CSRF-TOKEN': 'staff-csrf' }),
    )
  })

  it('edits account details and validates password confirmation', async () => {
    render(<StaffPage />)
    expect(await screen.findByText('初始管理员')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    let dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('显示姓名'), {
      target: { value: '平台管理员' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    expect(await screen.findByText('平台管理员')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重置密码' }))
    dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('新密码'), {
      target: { value: 'NewPassword2026' },
    })
    fireEvent.change(within(dialog).getByLabelText('再次输入新密码'), {
      target: { value: 'DifferentPassword2026' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('两次输入的密码不一致')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/reset-password'))).toBe(false)

    fireEvent.change(within(dialog).getByLabelText('再次输入新密码'), {
      target: { value: 'NewPassword2026' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/reset-password'))).toBe(true)
  })
})
