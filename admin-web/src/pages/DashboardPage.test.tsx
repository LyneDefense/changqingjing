import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminDashboard } from '../api/admin'
import { AuthContext } from '../auth/authContextValue'
import type { AuthContextValue } from '../auth/authContextValue'
import { DashboardPage } from './DashboardPage'

const authValue: AuthContextValue = {
  status: 'authenticated',
  sessionExpired: false,
  user: {
    id: '5be477df-6394-4037-aa38-d2b901f5eaf4',
    loginName: 'admin',
    displayName: '管理员',
    role: 'ADMIN',
    permissions: ['content:read', 'user:read', 'staff:manage'],
  },
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  hasPermission: (permission) => ['content:read', 'user:read', 'staff:manage'].includes(permission),
}

describe('DashboardPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const data: AdminDashboard = {
    userMetricsVisible: true, statistics: { totalRegistrations: 128, todayRegistrations: 3, last7DaysRegistrations: 15, frozenUsers: 2 },
    registrationTrend: Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-${String(i + 9).padStart(2, '0')}`, count: i === 6 ? 3 : 2 })),
    recentUsers: [{ id: 'recent-user', displayName: '山水旅人', maskedPhone: '138****9190', status: 'ACTIVE', registeredAt: '2026-09-15T00:00:00Z' }],
    recentOperations: [], trendDays: 7, generatedAt: '2026-09-15T01:00:00Z', timezone: 'Asia/Shanghai',
  }
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  function show(value = authValue) {
    return render(<MemoryRouter><AuthContext.Provider value={value}><DashboardPage /></AuthContext.Provider></MemoryRouter>)
  }
  it('shows the initial management modules', () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <DashboardPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '工作台' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看注册用户' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看完整使用指南' })).toHaveAttribute('href', '/guide')
    expect(screen.getByText('宣传视频')).toBeInTheDocument()
    expect(screen.getByText('公司介绍')).toBeInTheDocument()
  })
  it('shows real metrics and masked recent users with direct detail links', async () => {
    show()
    expect(await screen.findByText('128')).toBeInTheDocument()
    expect(screen.getByText('138****9190')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /山水旅人/ })).toHaveAttribute('href', '/users?userId=recent-user')
    expect(screen.getByRole('img', { name: '近 7 天首次注册趋势，共新增 15 人' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '近 30 天' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/dashboard?days=30'))).toBe(true))
  })
  it('never renders user statistics or links for operators', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { ...data, userMetricsVisible: false, statistics: null, recentUsers: [], registrationTrend: [] } })))
    show({ ...authValue, user: { ...authValue.user!, role: 'OPERATOR' }, hasPermission: (permission) => ['content:read', 'audit:read'].includes(permission) })
    expect(await screen.findByText('暂无操作记录')).toBeInTheDocument()
    expect(screen.queryByText('累计注册')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '最近注册' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '查看注册用户' })).not.toBeInTheDocument()
    expect(screen.getByText(/注册数据仅管理员可查看/)).toBeInTheDocument()
  })
  it('does not turn a failed request into fabricated zero metrics and supports retry', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'INTERNAL_ERROR', message: '看板暂不可用' }), { status: 500 }))
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('看板暂不可用')
    const metrics = screen.getByRole('region', { name: '注册数据概览' })
    expect(within(metrics).getAllByText('—')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    expect(await screen.findByText('128')).toBeInTheDocument()
  })
  it('renders genuine empty counts as zero and accessible daily details', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { ...data, statistics: { totalRegistrations: 0, todayRegistrations: 0, last7DaysRegistrations: 0, frozenUsers: 0 }, recentUsers: [], registrationTrend: data.registrationTrend.map((point) => ({ ...point, count: 0 })) } })))
    show()
    expect(await screen.findByText('暂无注册用户')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '注册数据概览' })).getAllByText('0')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: '2026-09-15：新增 0 人' }))
    expect(screen.getByRole('status')).toHaveTextContent('2026-09-15 · 新增 0 人')
  })
})
