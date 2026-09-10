import { useEffect, useState } from 'react'
import { getAdminMedia } from '../api/admin'
import type { AdminMedia } from '../api/admin'

export function MediaPreview({
  mediaId,
  alt = '',
  objectPosition,
}: {
  mediaId?: string
  alt?: string
  objectPosition?: string
}) {
  const [media, setMedia] = useState<AdminMedia>()

  useEffect(() => {
    let active = true
    if (!mediaId) return
    void getAdminMedia(mediaId).then((loaded) => {
      if (active) setMedia(loaded)
    })
    return () => {
      active = false
    }
  }, [mediaId])

  if (!media?.previewUrl) return null
  return media.mediaType === 'IMAGE'
    ? <img alt={alt} className="content-image-preview" src={media.previewUrl} style={{ objectPosition }} />
    : <video className="content-video-preview" controls src={media.previewUrl} />
}
