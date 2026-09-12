import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAdminApiForTests } from '../api/admin'
import { ComingSoonPage } from './ComingSoonPage'
import { CooperationPage } from './CooperationPage'

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Cooperation operations pages', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetAdminApiForTests()
  })

  it('presents revenue and cooperation value as operational sections', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({
      version: 0,
      visibility: 'HIDDEN',
    })))
    const router = createMemoryRouter([{ path: '/', Component: CooperationPage }])

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: '收益板块管理' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '核心收益来源' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收益板块' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '敬请期待' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('招商收益')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收起收益分类 1' }))
    expect(screen.queryByDisplayValue('招商收益')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '敬请期待' }))
    expect(screen.getByText('更多合作方案正在准备中')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /合作价值总结/ }))
    expect(screen.getByRole('heading', { name: '合作价值总结' })).toBeInTheDocument()
    expect(screen.queryByText('页面信息')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('页面标题')).not.toBeInTheDocument()
    expect(screen.queryByText('合作价值图片（选填）')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /添加合作价值/ })).toBeInTheDocument()
  })

  it('maps legacy free-form icons to a system icon instead of exposing the raw value', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({
      version: 1,
      visibility: 'HIDDEN',
      draft: {
        id: 1,
        title: '旧标题',
        summary: '旧简介',
        revenueSections: [{ title: '供应链', description: '产品流水收益', icon: '2', displayOrder: 0 }],
        valueSections: [{ title: '资源整合', description: '链接文旅资源', displayOrder: 0 }],
      },
    })))
    const router = createMemoryRouter([{ path: '/', Component: CooperationPage }])

    render(<RouterProvider router={router} />)

    const iconPicker = await screen.findByLabelText('收益分类 1 图标')
    expect(iconPicker).toHaveValue('product')
    expect(screen.queryByDisplayValue('2')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('旧标题')).not.toBeInTheDocument()
  })

  it('keeps unavailable modules as explicit placeholders', () => {
    const router = createMemoryRouter([{
      path: '/',
      element: <ComingSoonPage title="分公司方案" />,
    }])

    render(<RouterProvider router={router} />)

    expect(screen.getByText('敬请期待')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '分公司方案暂未开放' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /启用|发布/ })).not.toBeInTheDocument()
  })
})
