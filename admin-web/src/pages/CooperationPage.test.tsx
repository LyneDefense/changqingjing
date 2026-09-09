import { cleanup, render, screen } from '@testing-library/react'
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
    expect(screen.getByRole('heading', { name: '合作价值' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('招商收益')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加合作价值' })).toBeInTheDocument()
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
