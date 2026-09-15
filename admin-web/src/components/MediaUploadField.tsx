import { useEffect, useState } from 'react'
import { AdminApiError, getAdminMedia } from '../api/admin'
import type { AdminMedia, MediaPurpose, MediaType } from '../api/admin'
import { uploadMedia } from '../media/uploadMedia'

interface MediaUploadFieldProps {
  accept: string
  label: string
  mediaId?: string
  mediaType: MediaType
  purpose: MediaPurpose
  onReady: (media: AdminMedia) => void
}

function uploadError(error: unknown) {
  if (error instanceof AdminApiError) return error.message
  if (error instanceof Error) return error.message
  return '上传失败，请重试'
}

export function MediaUploadField({
  accept,
  label,
  mediaId,
  mediaType,
  purpose,
  onReady,
}: MediaUploadFieldProps) {
  const [media, setMedia] = useState<AdminMedia>()
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!mediaId) {
      return () => { active = false }
    }
    void getAdminMedia(mediaId)
      .then((result) => {
        if (active) setMedia(result)
      })
      .catch((requestError: unknown) => {
        if (active) setError(uploadError(requestError))
      })
    return () => { active = false }
  }, [mediaId])

  const displayedMedia = media?.id === mediaId ? media : undefined

  async function selectFile(file?: File) {
    if (!file) return
    setUploading(true)
    setProgress(0)
    setError('')
    try {
      const ready = await uploadMedia(file, mediaType, purpose, setProgress)
      setMedia(ready)
      onReady(ready)
    } catch (requestError) {
      setError(uploadError(requestError))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="media-upload-field">
      <div className="media-upload-copy">
        <strong>{label}</strong>
        <small>
          {mediaType === 'IMAGE'
            ? '支持 JPEG、PNG、WebP，最大 10 MB'
            : '支持 MP4，最大 200 MB'}
        </small>
      </div>
      {displayedMedia?.previewUrl && displayedMedia.mediaType === 'IMAGE' && (
        <img alt={displayedMedia.originalFilename} className="media-image-preview" src={displayedMedia.previewUrl} />
      )}
      {displayedMedia?.previewUrl && displayedMedia.mediaType === 'VIDEO' && (
        <video className="media-video-preview" controls poster="" preload="metadata" src={displayedMedia.previewUrl} />
      )}
      <div className="media-upload-actions">
        <label className={`secondary-button file-button ${uploading ? 'disabled' : ''}`}>
          {displayedMedia ? '替换文件' : '选择文件'}
          <input
            accept={accept}
            aria-label={`选择${label}`}
            disabled={uploading}
            onChange={(event) => {
              void selectFile(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
            type="file"
          />
        </label>
        {uploading && <span aria-live="polite" role="status">上传中 {progress}%</span>}
        {!uploading && displayedMedia?.status === 'READY' && <span className="media-ready">已校验</span>}
      </div>
      <small className="mobile-upload-hint">
        {mediaType === 'IMAGE' ? '请选 JPG、PNG 或 WebP 图片；HEIC 原图需先转换。' : '请选 MP4 视频；MOV 视频需先转换。'}
        上传期间请保持页面打开。
      </small>
      {uploading && <progress max={100} value={progress} />}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
