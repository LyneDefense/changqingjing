import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmMapSelection } from '../api/admin'
import { MapLocationPicker } from './MapLocationPicker'

vi.mock('../api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/admin')>()
  return { ...actual, confirmMapSelection: vi.fn() }
})

describe('MapLocationPicker', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TENCENT_MAP_KEY', 'test-map-key')
    vi.stubEnv('VITE_TENCENT_MAP_REFERER', 'cqj-admin')
    vi.mocked(confirmMapSelection).mockResolvedValue({
      id: '1127ac49-d02c-4c0a-ad72-7a76f3814379',
      providerName: '深圳市南山智园',
      providerAddress: '广东省深圳市南山区学苑大道1001号',
      latitude: 22.5949,
      longitude: 113.9986,
      coordinateSystem: 'GCJ02',
      expiresAt: '2026-09-10T12:00:00Z',
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('requires an explicit confirmation after selecting a place in the map', async () => {
    const onConfirmed = vi.fn()
    render(<MapLocationPicker onConfirmed={onConfirmed} />)

    fireEvent.click(screen.getByRole('button', { name: '选择地图位置' }))

    const confirmButton = screen.getByRole('button', { name: '确认使用此位置' })
    expect(confirmButton).toBeDisabled()

    const iframe = screen.getByTitle('腾讯地图位置选择') as HTMLIFrameElement
    expect(iframe.contentWindow).not.toBeNull()
    fireEvent(window, new MessageEvent('message', {
      data: {
        module: 'locationPicker',
        poiname: '深圳市南山智园',
        poiaddress: '广东省深圳市南山区学苑大道1001号',
        latlng: { lat: 22.5949, lng: 113.9986 },
      },
      origin: 'https://apis.map.qq.com',
      source: iframe.contentWindow,
    }))

    expect(await screen.findByText('深圳市南山智园')).toBeInTheDocument()
    expect(confirmMapSelection).not.toHaveBeenCalled()
    expect(onConfirmed).not.toHaveBeenCalled()

    fireEvent.click(confirmButton)

    await waitFor(() => expect(confirmMapSelection).toHaveBeenCalledWith({
      providerName: '深圳市南山智园',
      providerAddress: '广东省深圳市南山区学苑大道1001号',
      latitude: 22.5949,
      longitude: 113.9986,
    }))
    expect(onConfirmed).toHaveBeenCalledWith(expect.objectContaining({
      providerName: '深圳市南山智园',
    }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
