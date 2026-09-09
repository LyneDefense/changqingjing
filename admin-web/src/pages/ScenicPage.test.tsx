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
  })
})
