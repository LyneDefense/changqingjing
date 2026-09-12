import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAdminApiForTests } from '../api/admin'
import { ScenicPage } from './ScenicPage'

vi.mock('../components/MediaPreview', () => ({
  MediaPreview: ({ alt }: { alt?: string }) => <span>{alt}封面</span>,
}))

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ScenicPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetAdminApiForTests()
  })

  it('separates publication and opening statuses in the operations list', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (!url.includes('/api/v1/admin/scenics?')) {
        throw new Error('Unexpected request: ' + url)
      }
      return response({
        items: [{
          id: 'df047f8e-5894-4db9-9e90-36a8548e5bbb',
          version: 2,
          title: '九宫山景区',
          status: 'ONLINE',
          openStatus: 'PAUSED',
          displayOrder: 1,
          hasUnpublishedChanges: false,
          viewCount: 18,
          updatedAt: '2026-09-09T08:00:00Z',
        }],
        page: 1,
        pageSize: 20,
        total: 1,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createMemoryRouter(
      [{ path: '/', Component: ScenicPage }],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('九宫山景区')).toBeInTheDocument()
    expect(screen.getByText('展示中', { selector: '.status-pill' })).toBeInTheDocument()
    expect(screen.getByText('暂停开放', { selector: '.status-pill' })).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('发布状态'), {
      target: { value: 'ONLINE' },
    })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('status=ONLINE'),
        expect.anything(),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /新增景区/ }))
    expect(screen.getByRole('tab', { name: '基础信息' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('景区详情实时预览')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /详情内容/ }))
    expect(screen.getByRole('button', { name: '＋ 添加图片' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /导航位置/ }))
    expect(screen.getByText(/不选择地图位置也能正常保存和发布/)).toBeInTheDocument()
  })
})
