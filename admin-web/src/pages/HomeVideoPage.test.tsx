import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAdminApiForTests } from '../api/admin'
import { HomeVideoPage } from './HomeVideoPage'

vi.mock('../components/MediaPreview', () => ({
  MediaPreview: ({ alt }: { alt?: string }) => <span>{alt}封面</span>,
}))

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HomeVideoPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetAdminApiForTests()
  })

  it('shows an operational video list and filters by status', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (!url.includes('/contents/home-videos?')) {
        throw new Error('Unexpected request: ' + url)
      }
      return response({
        items: [{
          id: 'df047f8e-5894-4db9-9e90-36a8548e5bbb',
          version: 2,
          title: '秋季宣传片',
          coverMediaId: '4e0caa36-e0c8-49e3-995f-6bddff507975',
          status: 'ONLINE',
          hasUnpublishedChanges: false,
          updatedAt: '2026-09-09T08:00:00Z',
        }],
        page: 1,
        pageSize: 20,
        total: 1,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const router = createMemoryRouter(
      [{ path: '/', Component: HomeVideoPage }],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('秋季宣传片')).toBeInTheDocument()
    expect(screen.getByText('首页展示中', { selector: '.status-pill' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('视频状态'), {
      target: { value: 'ONLINE' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('status=ONLINE'),
        expect.anything(),
      )
    })
  })
})
