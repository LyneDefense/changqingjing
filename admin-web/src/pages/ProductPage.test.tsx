import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAdminApiForTests } from '../api/admin'
import { ProductPage } from './ProductPage'

vi.mock('../components/MediaPreview', () => ({
  MediaPreview: ({ alt }: { alt?: string }) => <span>{alt}封面</span>,
}))

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ProductPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetAdminApiForTests()
  })

  it('separates product operations from optional category settings', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/product-categories')) {
        return response([{
          id: 'category-1',
          name: '康养好物',
          displayOrder: 1,
          status: 'ONLINE',
          hasUnpublishedChanges: false,
          version: 2,
          updatedAt: '2026-09-09T10:00:00Z',
        }])
      }
      if (url.includes('/products?')) {
        return response({
          items: [{
            id: 'product-1',
            name: '九宫山草本香囊',
            categoryId: 'category-1',
            categoryName: '康养好物',
            status: 'ONLINE',
            displayOrder: 1,
            hasUnpublishedChanges: false,
            version: 2,
            updatedAt: '2026-09-09T10:00:00Z',
          }],
          page: 1,
          pageSize: 20,
          total: 1,
        })
      }
      throw new Error('Unexpected request: ' + url)
    })
    vi.stubGlobal('fetch', fetchMock)
    const router = createMemoryRouter([{ path: '/', Component: ProductPage }])

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('九宫山草本香囊')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /新增福利产品/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /新增福利产品/ }))
    expect(screen.getByRole('tab', { name: '基础信息' })).toBeInTheDocument()
    expect(screen.getByText('维护会员端双列产品卡片、产品相册与选填详情。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '双列卡片' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /详情内容/ }))
    expect(screen.getByText('当前未设置产品详情，小程序将只显示产品基本信息。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回产品列表' }))
    fireEvent.click(screen.getByRole('tab', { name: '产品分类设置' }))
    expect(await screen.findByText('分类是可选筛选项。停用分类只隐藏会员端的分类入口，不会下架这个分类中的产品。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /新增分类/ })).toBeInTheDocument()
    expect(screen.getAllByText('康养好物').length).toBeGreaterThan(0)
  })

  it('sends the selected operational status filter', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/product-categories')) return response([])
      if (url.includes('/products?')) {
        return response({ items: [], page: 1, pageSize: 20, total: 0 })
      }
      throw new Error('Unexpected request: ' + url)
    })
    vi.stubGlobal('fetch', fetchMock)
    const router = createMemoryRouter([{ path: '/', Component: ProductPage }])

    render(<RouterProvider router={router} />)
    await screen.findByText('暂无福利产品，点击“新增福利产品”开始创建。')
    fireEvent.change(screen.getByLabelText('上架状态'), { target: { value: 'OFFLINE' } })

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes('status=OFFLINE'))).toBe(true)
    })
  })
})
