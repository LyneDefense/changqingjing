import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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
})
