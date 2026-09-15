import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuditEvent } from '../api/admin'
import { AuthContext } from '../auth/authContextValue'
import type { AuthContextValue } from '../auth/authContextValue'
import { AuditPage } from './AuditPage'

const event: AuditEvent = {
  id: 'ef7ba355-082b-4faf-89d1-311794f3fdad', actorLoginName: 'operator.one', actorDisplayName: '运营一',
  action: 'COMPANY_DRAFT_SAVE', actionLabel: '保存草稿', module: 'COMPANY', moduleLabel: '公司介绍',
  targetType: 'CONTENT_ENTRY', targetName: '品牌介绍', result: 'SUCCESS', affectsOnline: false,
  clientIp: '198.51.100.24', clientSummary: 'Chrome / macOS', loginBatchId: 'test-batch', traceId: 'test-trace',
  changeSummary: ['简介修改', '新增 2 个媒体文件'], createdAt: '2026-09-15T10:00:00Z', historical: false,
}
const auth: AuthContextValue = {
  status: 'authenticated', sessionExpired: false, login: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
  hasPermission: () => true,
  user: { id: 'test-admin', loginName: 'admin', displayName: '管理员', role: 'ADMIN', permissions: ['audit:read'] },
}
const response = (data: unknown) => new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } })
function show(value = auth, route = '/audit-events') {
  render(<MemoryRouter initialEntries={[route]}><AuthContext.Provider value={value}><AuditPage /></AuthContext.Provider></MemoryRouter>)
}

describe('AuditPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => String(url).includes('/audit-events?')
      ? response({ items: [event], page: 1, pageSize: 20, total: 1 }) : response(event))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  it('distinguishes saved drafts and opens a readonly change summary drawer', async () => {
    show()
    expect(await screen.findByText('成功 · 未发布')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: '查看详情' })
    button.focus()
    fireEvent.click(button)
    const drawer = await screen.findByRole('dialog')
    expect(await within(drawer).findByText('简介修改')).toBeInTheDocument()
    expect(within(drawer).getByText('新增 2 个媒体文件')).toBeInTheDocument()
    expect(within(drawer).getByText('test-batch')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
    fireEvent.keyDown(drawer, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true)
  })
  it('submits filters together and searches target names or IPs', async () => {
    show(); await screen.findByText('品牌介绍')
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-09-14' } })
    fireEvent.change(screen.getByLabelText('业务模块'), { target: { value: 'COMPANY' } })
    fireEvent.change(screen.getByLabelText('操作类型'), { target: { value: 'DRAFT_SAVE' } })
    fireEvent.change(screen.getByLabelText('内容 / 来源 IP'), { target: { value: '198.51.100.24' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '查询' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('module=COMPANY') && String(url).includes('action=DRAFT_SAVE') && String(url).includes('keyword=198.51.100.24'))).toBe(true))
  })
  it('does not invent missing IPs or summaries in historical records', async () => {
    const old = { ...event, clientIp: undefined, loginBatchId: undefined, historical: true, changeSummary: [] }
    fetchMock.mockImplementation(async (url: string) => String(url).includes('/audit-events?') ? response({ items: [old], page: 1, pageSize: 20, total: 1 }) : response(old))
    show(auth, `/audit-events?logId=${event.id}`)
    expect(await screen.findByText('旧记录未保存变更摘要')).toBeInTheDocument()
    expect(await screen.findByText('IP 未记录')).toBeInTheDocument()
  })
  it('explains own-account visibility to operators and exposes a retry on errors', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: '日志服务暂不可用', traceId: 'failure-trace' }), { status: 500 }))
    show({ ...auth, user: { ...auth.user!, role: 'OPERATOR' } })
    expect(screen.getByText('仅查看自己的操作记录')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('日志服务暂不可用')
    expect(screen.queryByText('没有符合条件的操作记录。')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
