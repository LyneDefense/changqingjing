import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminApiError, confirmMapSelection } from '../api/admin'
import type { MapSelection, ScenicLocation } from '../api/admin'

interface MapLocationPickerProps {
  location?: ScenicLocation
  onConfirmed: (selection: MapSelection) => void
}

interface PickerMessage {
  module?: string
  poiname?: string
  poiaddress?: string
  latlng?: {
    lat?: number
    lng?: number
  }
}

interface PendingLocation {
  providerName: string
  providerAddress: string
  latitude: number
  longitude: number
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) return error.message
  return '位置确认失败，请重新选择'
}

export function MapLocationPicker({ location, onConfirmed }: MapLocationPickerProps) {
  const mapKey = (import.meta.env.VITE_TENCENT_MAP_KEY as string | undefined)?.trim() ?? ''
  const mapReferer =
    (import.meta.env.VITE_TENCENT_MAP_REFERER as string | undefined)?.trim()
    || 'changqingjing-admin'
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [pendingLocation, setPendingLocation] = useState<PendingLocation>()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const pickerUrl = useMemo(() => {
    const query = new URLSearchParams({
      search: '1',
      type: '1',
      key: mapKey,
      referer: mapReferer,
    })
    if (location) query.set('coord', `${location.latitude},${location.longitude}`)
    return `https://apis.map.qq.com/tools/locpicker?${query}`
  }, [location, mapKey, mapReferer])

  useEffect(() => {
    if (!open || !mapKey) return

    function receiveLocation(event: MessageEvent<PickerMessage>) {
      if (event.origin !== 'https://apis.map.qq.com') return
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data
      const latitude = Number(data?.latlng?.lat)
      const longitude = Number(data?.latlng?.lng)
      const providerName = data?.poiname?.trim() ?? ''
      const providerAddress = data?.poiaddress?.trim() ?? ''
      if (
        data?.module !== 'locationPicker'
        || !providerName
        || !providerAddress
        || !Number.isFinite(latitude)
        || !Number.isFinite(longitude)
      ) return

      setError('')
      setPendingLocation({ providerName, providerAddress, latitude, longitude })
    }

    window.addEventListener('message', receiveLocation)
    return () => window.removeEventListener('message', receiveLocation)
  }, [mapKey, open])

  function closePicker() {
    setOpen(false)
    setPendingLocation(undefined)
    setError('')
  }

  async function confirmPendingLocation() {
    if (!pendingLocation) return
    setConfirming(true)
    setError('')
    try {
      const selection = await confirmMapSelection(pendingLocation)
      onConfirmed(selection)
      closePicker()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <section className="map-location-field">
      <div className="map-location-heading">
        <div>
          <strong>导航位置（选填）</strong>
          <small>配置后，小程序会显示导航入口；不配置也可以正常保存和发布。</small>
        </div>
        <button
          className="secondary-button"
          disabled={!mapKey}
          onClick={() => {
            setError('')
            setPendingLocation(undefined)
            setOpen(true)
          }}
          type="button"
        >
          {location ? '重新选择地图位置' : '选择地图位置'}
        </button>
      </div>

      {!mapKey && (
        <p className="notice warning-notice">
          当前未启用地图选点。如需导航功能，请让开发人员配置 VITE_TENCENT_MAP_KEY；
          不需要导航可直接继续编辑。
        </p>
      )}

      {location ? (
        <div className="selected-location-card">
          <strong>{location.providerName}</strong>
          <span>{location.providerAddress}</span>
          <small>已确认导航坐标 · GCJ-02</small>
        </div>
      ) : (
        <p className="empty-inline">尚未选择导航位置。保存和发布不受影响，小程序不会显示导航入口。</p>
      )}

      {open && (
        <div className="modal-backdrop" role="presentation">
          <article aria-modal="true" className="modal-card map-picker-modal" role="dialog">
            <div className="modal-header">
              <div>
                <p className="eyebrow">腾讯地图选点</p>
                <h2>搜索并确认导航位置</h2>
              </div>
              <button
                aria-label="关闭地图"
                className="icon-button"
                disabled={confirming}
                onClick={closePicker}
                type="button"
              >×</button>
            </div>
            <p className="modal-description">先在地图中点击一个地点，再核对下方名称和地址，确认后才会带回编辑表单。</p>
            <iframe
              allow="geolocation"
              className="map-picker-frame"
              ref={iframeRef}
              src={pickerUrl}
              title="腾讯地图位置选择"
            />
            <div aria-live="polite" className="map-picker-confirmation">
              {pendingLocation ? (
                <div className="map-picker-selected-place">
                  <small>已选择，确认前不会修改原导航位置</small>
                  <strong>{pendingLocation.providerName}</strong>
                  <span>{pendingLocation.providerAddress}</span>
                </div>
              ) : (
                <p className="empty-inline">请先在地图中搜索并点击一个地点。</p>
              )}
              <div className="map-picker-actions">
                <button className="secondary-button" disabled={confirming} onClick={closePicker} type="button">取消</button>
                <button
                  className="primary-button"
                  disabled={!pendingLocation || confirming}
                  onClick={() => void confirmPendingLocation()}
                  type="button"
                >
                  {confirming ? '正在确认…' : '确认使用此位置'}
                </button>
              </div>
            </div>
            {error && <p className="notice error-notice" role="alert">{error}</p>}
          </article>
        </div>
      )}
    </section>
  )
}
