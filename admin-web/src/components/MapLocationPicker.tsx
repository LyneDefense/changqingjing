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

const mapKey = (import.meta.env.VITE_TENCENT_MAP_KEY as string | undefined)?.trim() ?? ''
const mapReferer =
  (import.meta.env.VITE_TENCENT_MAP_REFERER as string | undefined)?.trim()
  || 'changqingjing-admin'

function errorText(error: unknown) {
  if (error instanceof AdminApiError) return error.message
  return '位置确认失败，请重新选择'
}

export function MapLocationPicker({ location, onConfirmed }: MapLocationPickerProps) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
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
  }, [location])

  useEffect(() => {
    if (!open || !mapKey) return

    async function receiveLocation(event: MessageEvent<PickerMessage>) {
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

      setConfirming(true)
      setError('')
      try {
        const selection = await confirmMapSelection({
          providerName,
          providerAddress,
          latitude,
          longitude,
        })
        onConfirmed(selection)
        setOpen(false)
      } catch (requestError) {
        setError(errorText(requestError))
      } finally {
        setConfirming(false)
      }
    }

    window.addEventListener('message', receiveLocation)
    return () => window.removeEventListener('message', receiveLocation)
  }, [onConfirmed, open])

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
                onClick={() => setOpen(false)}
                type="button"
              >×</button>
            </div>
            <p className="modal-description">在地图中搜索地点并点击确认，系统会保存地图原名、详细地址和导航坐标。</p>
            <iframe
              allow="geolocation"
              className="map-picker-frame"
              ref={iframeRef}
              src={pickerUrl}
              title="腾讯地图位置选择"
            />
            {confirming && <p className="empty-inline">正在确认位置…</p>}
            {error && <p className="notice error-notice" role="alert">{error}</p>}
          </article>
        </div>
      )}
    </section>
  )
}
