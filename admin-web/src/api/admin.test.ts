import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loginAdmin, resetAdminApiForTests } from './admin'

describe('admin API session protection', () => {
  beforeEach(() => resetAdminApiForTests())

  afterEach(() => vi.unstubAllGlobals())

  it('keeps cookies in the browser and adds the in-memory CSRF token to writes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          headerName: 'X-CSRF-TOKEN',
          parameterName: '_csrf',
          token: 'csrf-value',
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          id: '5be477df-6394-4037-aa38-d2b901f5eaf4',
          loginName: 'admin',
          displayName: '管理员',
          role: 'ADMIN',
          permissions: ['staff:manage'],
        },
      })))
    vi.stubGlobal('fetch', fetchMock)

    await loginAdmin('admin', 'password')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/admin/auth/csrf',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/admin/auth/login',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-CSRF-TOKEN': 'csrf-value' }),
      }),
    )
    expect(localStorage).toHaveLength(0)
  })
})
