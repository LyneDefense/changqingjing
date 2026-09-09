import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/authContextValue'
import type { AuthContextValue } from '../auth/authContextValue'
import { Sidebar } from './Sidebar'

function authValue(permissions: string[]): AuthContextValue {
  return {
    status: 'authenticated',
    sessionExpired: false,
    user: {
      id: '5be477df-6394-4037-aa38-d2b901f5eaf4',
      loginName: 'operator',
      displayName: '运营人员',
      role: 'OPERATOR',
      permissions,
    },
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    hasPermission: (permission) => permissions.includes(permission),
  }
}

describe('Sidebar', () => {
  it('does not show administrator-only menus to operators', () => {
    render(
      <AuthContext.Provider value={authValue(['content:read'])}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(screen.getByRole('link', { name: '首页宣传视频' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '公司介绍' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '注册用户' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '后台人员' })).not.toBeInTheDocument()
  })
})
