import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/authContextValue'
import type { AuthContextValue } from '../auth/authContextValue'
import { GuidePage } from './GuidePage'

function renderGuide(permissions = ['content:read', 'staff:manage', 'user:read']) {
  const auth: AuthContextValue = {
    status: 'authenticated', sessionExpired: false,
    user: { id: 'guide-reader', loginName: 'reader', displayName: '管理人员', role: 'OPERATOR', permissions },
    login: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
    hasPermission: (permission) => permissions.includes(permission),
  }
  return render(<AuthContext.Provider value={auth}><MemoryRouter><GuidePage /></MemoryRouter></AuthContext.Provider>)
}

afterEach(cleanup)

describe('GuidePage', () => {
  it('starts with the publishing workflow and explains draft safety', () => {
    renderGuide()
    expect(screen.getByRole('heading', { name: '后台使用指南' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '三步完成内容发布' })).toBeInTheDocument()
    expect(screen.getByText(/只有发布或上架成功后/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '快速上手' })).toHaveAttribute('aria-current', 'page')
  })

  it('switches chapters and documents product galleries, covers and optional details', () => {
    renderGuide()
    fireEvent.click(screen.getByRole('button', { name: '会员福利' }))
    expect(screen.getByRole('heading', { name: '会员福利' })).toBeInTheDocument()
    expect(screen.getByText(/产品详情不是必填/)).toBeInTheDocument()
    expect(screen.getByText(/详情顶部可左右滑动全部产品图片/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '进入会员福利' })).toHaveAttribute('href', '/products')
    expect(screen.getByRole('button', { name: '会员福利' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('heading', { name: '三步完成内容发布' })).not.toBeInTheDocument()
  })

  it('searches all chapters and shows matching FAQ answers in collapsible entries', () => {
    renderGuide()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索使用指南' }), { target: { value: '地图' } })
    expect(screen.getByRole('status')).toHaveTextContent('找到 2 个相关主题')
    expect(screen.getByRole('heading', { name: '景区管理' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '首页头图' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '常见问题 QA' }))
    const question = screen.getByText('不配置地图，景区能保存和发布吗？')
    const entry = question.closest('details')!
    expect(entry).not.toHaveAttribute('open')
    fireEvent.click(question)
    expect(entry).toHaveAttribute('open')
    expect(screen.getByText(/可以跳过地图选点，只维护景区介绍/)).toBeVisible()
    expect(screen.queryByText('停用产品分类后，为什么产品还在？')).not.toBeInTheDocument()
    fireEvent.click(question)
    expect(entry).not.toHaveAttribute('open')
  })

  it('can clear an empty search and restore the directory', () => {
    renderGuide()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索使用指南' }), { target: { value: '并不存在的指南主题' } })
    expect(screen.getByRole('heading', { name: '没有找到相关主题' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '查看全部指南' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('heading', { name: '快速上手' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '公司介绍' })).toBeInTheDocument()
  })

  it('allows operators to read account guidance without linking to restricted pages', () => {
    renderGuide(['content:read'])
    fireEvent.click(screen.getByRole('button', { name: '后台账号与权限' }))
    expect(screen.getByRole('heading', { name: '后台账号与权限' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '进入后台人员' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '注册用户' }))
    expect(screen.queryByRole('link', { name: '进入注册用户' })).not.toBeInTheDocument()
    expect(screen.getByText(/本功能仅管理员可用/)).toBeInTheDocument()
  })
})
