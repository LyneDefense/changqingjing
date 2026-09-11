import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAdminApiForTests } from '../api/admin'
import { HomeHeroPage } from './HomeHeroPage'

vi.mock('../components/MediaUploadField', () => ({
  MediaUploadField: ({ label }: { label: string }) => <div>{label}</div>,
}))

vi.mock('../components/MediaPreview', () => ({
  MediaPreview: ({ alt }: { alt?: string }) => <span>{alt}</span>,
}))

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HomeHeroPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetAdminApiForTests()
  })

  it('edits a complete image without separate title fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      id: '30d030ee-98cb-4d55-826a-6dfe2f06cdea',
      version: 3,
      visibility: 'PUBLISHED',
      draft: {
        id: '0d16a98c-89a7-40f1-955d-b069c2a0c721',
        revisionNumber: 3,
        title: '历史标题',
        subtitle: '历史副标题',
        coverMediaId: 'edb1f83e-0204-4b91-835b-19fd355584e9',
        focusX: 50,
        focusY: 50,
        createdBy: 'admin',
        createdAt: '2026-09-12T10:00:00Z',
      },
    })))

    const router = createMemoryRouter([{ path: '/', Component: HomeHeroPage }])
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: '首页头图管理' })).toBeInTheDocument()
    expect(screen.getByText('头图图片')).toBeInTheDocument()
    expect(screen.getByText('小程序预览')).toBeInTheDocument()
    expect(screen.queryByLabelText('主标题（选填）')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('副标题（选填）')).not.toBeInTheDocument()
    expect(screen.queryByText('历史标题')).not.toBeInTheDocument()
  })
})
