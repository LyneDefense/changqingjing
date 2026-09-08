import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AdminApiError,
  getAdminHomeVideoContent,
  previewAdminHomeVideoDraft,
  publishAdminHomeVideo,
  saveAdminHomeVideoDraft,
  unpublishAdminHomeVideo,
} from '../api/admin'
import type { AdminHomeVideoContent, AdminHomeVideoRevision } from '../api/admin'
import { MediaUploadField } from './MediaUploadField'

interface HomeVideoEditorProps {
  onDirtyChange: (dirty: boolean) => void
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) return error.message
  return '宣传视频操作失败，请稍后重试'
}

export function HomeVideoEditor({ onDirtyChange }: HomeVideoEditorProps) {
  const [content, setContent] = useState<AdminHomeVideoContent>()
  const [title, setTitle] = useState('')
  const [videoMediaId, setVideoMediaId] = useState('')
  const [coverMediaId, setCoverMediaId] = useState('')
  const [displayEnabled, setDisplayEnabled] = useState(true)
  const [preview, setPreview] = useState<AdminHomeVideoRevision>()
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const markDirty = useCallback(() => {
    setDirty(true)
    onDirtyChange(true)
  }, [onDirtyChange])

  const hydrate = useCallback((next: AdminHomeVideoContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setTitle(editable?.title ?? '')
    setVideoMediaId(editable?.videoMediaId ?? '')
    setCoverMediaId(editable?.coverMediaId ?? '')
    setDisplayEnabled(editable?.displayEnabled ?? true)
    setDirty(false)
    onDirtyChange(false)
  }, [onDirtyChange])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      hydrate(await getAdminHomeVideoContent())
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [hydrate])

  useEffect(() => {
    // Initial API loading is the effect's synchronization target.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!videoMediaId || !coverMediaId) return
    setBusy(true)
    setError('')
    try {
      hydrate(await saveAdminHomeVideoDraft({
        title,
        videoMediaId,
        coverMediaId,
        displayEnabled,
        expectedVersion: content?.version ?? 0,
      }))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function showPreview() {
    setBusy(true)
    setError('')
    try {
      setPreview(await previewAdminHomeVideoDraft())
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!content?.draft || dirty) return
    setBusy(true)
    setError('')
    try {
      hydrate(await publishAdminHomeVideo(content.version))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (!content || !window.confirm('确认下架宣传视频吗？首页将立即停止展示。')) return
    setBusy(true)
    setError('')
    try {
      hydrate(await unpublishAdminHomeVideo(content.version))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="empty-state">正在加载宣传视频…</p>

  return (
    <section className="content-editor home-video-editor">
      <div className="block-heading">
        <div>
          <p className="eyebrow">首页媒体</p>
          <h2>宣传视频</h2>
          <p>视频与封面都完成服务端校验后，才能保存和发布。</p>
        </div>
        <span className={`status-pill ${content?.visibility === 'PUBLISHED' ? 'active' : 'disabled'}`}>
          {content?.visibility === 'PUBLISHED' ? '线上展示中' : '未发布'}
        </span>
      </div>
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      <form onSubmit={save}>
        <label className="editor-field">
          视频标题
          <input
            maxLength={255}
            onChange={(event) => {
              setTitle(event.target.value)
              markDirty()
            }}
            required
            value={title}
          />
        </label>
        <div className="media-editor-grid">
          <MediaUploadField
            accept="video/mp4"
            label="宣传视频"
            mediaId={videoMediaId || undefined}
            mediaType="VIDEO"
            onReady={(media) => {
              setVideoMediaId(media.id)
              markDirty()
            }}
            purpose="HOME_VIDEO"
          />
          <MediaUploadField
            accept="image/jpeg,image/png,image/webp"
            label="视频封面"
            mediaId={coverMediaId || undefined}
            mediaType="IMAGE"
            onReady={(media) => {
              setCoverMediaId(media.id)
              markDirty()
            }}
            purpose="HOME_VIDEO_COVER"
          />
        </div>
        <label className="toggle-field">
          <input
            checked={displayEnabled}
            onChange={(event) => {
              setDisplayEnabled(event.target.checked)
              markDirty()
            }}
            type="checkbox"
          />
          发布后在首页展示
        </label>
        <div className="editor-actions">
          <button className="primary-button" disabled={busy || !dirty || !videoMediaId || !coverMediaId} type="submit">保存视频草稿</button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">核对草稿</button>
          <button className="secondary-button publish-button" disabled={busy || dirty || !content?.draft} onClick={() => void publish()} type="button">发布视频</button>
          {content?.visibility === 'PUBLISHED' && (
            <button className="secondary-button danger-button" disabled={busy} onClick={() => void unpublish()} type="button">下架视频</button>
          )}
        </div>
      </form>
      {preview && (
        <div className="notice success-notice video-preview-notice">
          已核对第 {preview.revisionNumber} 版“{preview.title}”：
          {preview.displayEnabled ? '发布后展示' : '发布后保持隐藏'}。
          <button className="text-button" onClick={() => setPreview(undefined)} type="button">关闭</button>
        </div>
      )}
    </section>
  )
}
