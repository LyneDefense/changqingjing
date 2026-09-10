import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAdminApiForTests } from '../api/admin'
import type { AdminCompanyContent, AdminCompanyRevision } from '../api/admin'
import { ContentPage } from './ContentPage'

const revision: AdminCompanyRevision = {
  id: 'a3feeaad-6e0d-4b02-8455-f0f624349b76',
  revisionNumber: 1,
  title: '常清净文旅投',
  summary: '连接文化与旅行',
  galleryMediaIds: [],
  blocks: [{ type: 'PARAGRAPH', text: '这是公司介绍正文。' }],
  createdBy: '5be477df-6394-4037-aa38-d2b901f5eaf4',
  createdAt: '2026-09-08T08:00:00Z',
}

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ContentPage', () => {
  let current: AdminCompanyContent
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetAdminApiForTests()
    current = { version: 0, visibility: 'HIDDEN' }
    fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.endsWith('/auth/csrf')) {
        return response({
          headerName: 'X-CSRF-TOKEN',
          parameterName: '_csrf',
          token: 'content-csrf',
        })
      }
      if (url.endsWith('/contents/company') && method === 'GET') {
        return response(current)
      }
      if (url.endsWith('/contents/company/draft') && method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as {
          title: string
          summary: string
          galleryMediaIds: string[]
          blocks: AdminCompanyRevision['blocks']
          expectedVersion: number
        }
        current = {
          id: 'b8e14ee4-d727-4164-a82a-196b23c94c3d',
          version: 1,
          visibility: 'HIDDEN',
          updatedAt: '2026-09-08T08:00:00Z',
          draft: { ...revision, ...body },
        }
        return response(current)
      }
      if (url.endsWith('/contents/company/preview')) {
        return response(current.draft)
      }
      if (url.endsWith('/contents/company/publish') && method === 'POST') {
        current = {
          ...current,
          version: 2,
          visibility: 'PUBLISHED',
          firstPublishedAt: '2026-09-08T08:05:00Z',
          published: current.draft,
        }
        return response(current)
      }
      throw new Error(`Unexpected request: ${method} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('saves a draft, previews it, and explicitly publishes it', async () => {
    const router = createMemoryRouter(
      [{ path: '/', Component: ContentPage }],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('尚未保存')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: revision.title },
    })
    fireEvent.change(screen.getByLabelText('首页简介'), {
      target: { value: revision.summary },
    })
    fireEvent.change(screen.getByLabelText('第 1 个板块标题'), {
      target: { value: '公司简介' },
    })
    fireEvent.change(screen.getByLabelText('第 1 个板块文字内容'), {
      target: { value: revision.blocks[0].text },
    })
    fireEvent.click(screen.getByRole('button', { name: '添加板块' }))
    fireEvent.change(screen.getByLabelText('第 2 个板块标题'), {
      target: { value: '企业定位' },
    })
    fireEvent.change(screen.getByLabelText('第 2 个板块文字内容'), {
      target: { value: '专注文旅融合发展。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))

    await waitFor(() => {
      expect(screen.getByText('第 1 版')).toBeInTheDocument()
    })
    expect(current.draft?.blocks).toEqual([
      { type: 'HEADING', text: '公司简介' },
      { type: 'PARAGRAPH', text: revision.blocks[0].text },
      { type: 'HEADING', text: '企业定位' },
      { type: 'PARAGRAPH', text: '专注文旅融合发展。' },
    ])
    const draftCall = fetchMock.mock.calls.find(
      ([url]) => String(url).endsWith('/contents/company/draft'),
    )
    expect(JSON.parse(String(draftCall?.[1]?.body))).toEqual(
      expect.objectContaining({ expectedVersion: 0, title: revision.title, galleryMediaIds: [] }),
    )
    expect(screen.queryByRole('button', { name: '添加一张图片' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '添加一段文字' })).not.toBeInTheDocument()
    expect(draftCall?.[1]?.headers).toEqual(
      expect.objectContaining({ 'X-CSRF-TOKEN': 'content-csrf' }),
    )

    fireEvent.click(screen.getByRole('button', { name: '预览草稿' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('这是公司介绍正文。')
    fireEvent.click(screen.getByRole('button', { name: '关闭预览' }))

    fireEvent.click(screen.getByRole('button', { name: '发布' }))
    expect(await screen.findByText('线上展示中')).toBeInTheDocument()
    expect(screen.queryByText('有未发布草稿')).not.toBeInTheDocument()
  })

  it('blocks navigation while edits have not been saved', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const router = createMemoryRouter(
      [
        { path: '/', Component: ContentPage },
        { path: '/other', element: <p>其他页面</p> },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)
    await screen.findByText('尚未保存')
    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '尚未保存的标题' },
    })
    await screen.findByText('修改尚未保存。预览和发布前请先保存草稿。')

    await router.navigate('/other')

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith('当前修改尚未保存，确定离开吗？')
    })
    expect(screen.queryByText('其他页面')).not.toBeInTheDocument()
  })
})
