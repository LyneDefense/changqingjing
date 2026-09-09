import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AdminApiError,
  createAdminHomeVideo,
  getAdminHomeVideoContent,
  previewAdminHomeVideoDraft,
  publishAdminHomeVideo,
  saveAdminHomeVideoDraft,
  unpublishAdminHomeVideo,
} from '../api/admin'
import type { AdminHomeVideoContent, AdminHomeVideoRevision } from '../api/admin'
import { MediaPreview } from './MediaPreview'
import { MediaUploadField } from './MediaUploadField'

interface HomeVideoEditorProps {
  videoId?: string
  onChanged: () => void
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message + (error.traceId ? '（追踪号：' + error.traceId + '）' : '')
  }
  return '宣传视频操作失败，请稍后重试'
}

export function HomeVideoEditor({
  videoId,
  onChanged,
  onClose,
  onDirtyChange,
}: HomeVideoEditorProps) {
  const [entryId, setEntryId] = useState(videoId)
  const [content, setContent] = useState<AdminHomeVideoContent>()
  const [title, setTitle] = useState('')
  const [videoMediaId, setVideoMediaId] = useState('')
  const [coverMediaId, setCoverMediaId] = useState('')
  const [preview, setPreview] = useState<AdminHomeVideoRevision>()
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(Boolean(videoId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const markDirty = useCallback(() => {
    setDirty(true)
    setNotice('')
    onDirtyChange(true)
  }, [onDirtyChange])

  const hydrate = useCallback((next: AdminHomeVideoContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setEntryId(next.id)
    setTitle(editable?.title ?? '')
    setVideoMediaId(editable?.videoMediaId ?? '')
    setCoverMediaId(editable?.coverMediaId ?? '')
    setDirty(false)
    onDirtyChange(false)
  }, [onDirtyChange])

  useEffect(() => {
    if (!videoId) return
    let active = true
    // Loading the selected record is the effect's synchronization target.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    void getAdminHomeVideoContent(videoId)
      .then((loaded) => {
        if (active) hydrate(loaded)
      })
      .catch((requestError) => {
        if (active) setError(errorText(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [hydrate, videoId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!videoMediaId || !coverMediaId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const input = {
        title,
        videoMediaId,
        coverMediaId,
        expectedVersion: content?.version ?? 0,
      }
      const saved = entryId
        ? await saveAdminHomeVideoDraft(entryId, input)
        : await createAdminHomeVideo(input)
      hydrate(saved)
      setNotice('草稿已保存，可以继续预览或发布。')
      onChanged()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function showPreview() {
    if (!entryId) return
    setBusy(true)
    setError('')
    try {
      setPreview(await previewAdminHomeVideoDraft(entryId))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!entryId || !content?.draft || dirty) return
    if (!window.confirm('发布后，这条视频会替换小程序首页当前展示的视频。确认发布吗？')) return
    setBusy(true)
    setError('')
    try {
      hydrate(await publishAdminHomeVideo(entryId, content.version))
      setNotice('已发布，小程序首页将展示这条视频。')
      onChanged()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (!entryId || !content) return
    if (!window.confirm('下架后，小程序首页将不再展示宣传视频。确认下架吗？')) return
    setBusy(true)
    setError('')
    try {
      hydrate(await unpublishAdminHomeVideo(entryId, content.version))
      setNotice('视频已下架。')
      onChanged()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  function closeEditor() {
    if (dirty && !window.confirm('宣传视频还有修改没有保存，确定返回列表吗？')) return
    onDirtyChange(false)
    onClose()
  }

  if (loading) return <p className="empty-state">正在加载宣传视频…</p>

  return (
    <section className="content-editor home-video-editor">
      <div className="block-heading">
        <div>
          <p className="eyebrow">{entryId ? '编辑宣传视频' : '新增宣传视频'}</p>
          <h2>{title || '未命名宣传视频'}</h2>
          <p>先上传视频和封面并保存草稿，核对无误后再发布。</p>
        </div>
        <div className="editor-heading-actions">
          {content && (
            <span className={'status-pill ' + (content.visibility === 'PUBLISHED' ? 'active' : 'disabled')}>
              {content.visibility === 'PUBLISHED' ? '首页展示中' : content.firstPublishedAt ? '已下架' : '草稿'}
            </span>
          )}
          <button className="secondary-button" onClick={closeEditor} type="button">返回视频列表</button>
        </div>
      </div>
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      {notice && <div className="notice success-notice">{notice}</div>}
      <form onSubmit={save}>
        <label className="editor-field">
          视频标题
          <input
            maxLength={255}
            onChange={(event) => {
              setTitle(event.target.value)
              markDirty()
            }}
            placeholder="输入便于运营人员识别的视频标题"
            required
            value={title}
          />
        </label>
        <div className="media-editor-grid">
          <MediaUploadField
            accept="video/mp4"
            label="宣传视频文件"
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
            label="首页展示封面"
            mediaId={coverMediaId || undefined}
            mediaType="IMAGE"
            onReady={(media) => {
              setCoverMediaId(media.id)
              markDirty()
            }}
            purpose="HOME_VIDEO_COVER"
          />
        </div>
        <div className="editor-actions">
          <button className="primary-button" disabled={busy || !dirty || !videoMediaId || !coverMediaId} type="submit">
            {busy ? '处理中…' : '保存草稿'}
          </button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">播放预览</button>
          <button className="secondary-button publish-button" disabled={busy || dirty || !content?.draft} onClick={() => void publish()} type="button">发布到首页</button>
          {content?.visibility === 'PUBLISHED' && (
            <button className="secondary-button danger-button" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>
          )}
        </div>
        {dirty && <p className="unsaved-indicator">修改尚未保存，请先保存草稿。</p>}
      </form>
      {preview && (
        <div className="modal-backdrop" role="presentation">
          <article aria-labelledby="video-preview-title" aria-modal="true" className="modal-card content-preview" role="dialog">
            <div className="modal-header">
              <div>
                <p className="eyebrow">发布前预览</p>
                <h2 id="video-preview-title">{preview.title}</h2>
              </div>
              <button aria-label="关闭预览" className="icon-button" onClick={() => setPreview(undefined)} type="button">×</button>
            </div>
            <MediaPreview mediaId={preview.videoMediaId} />
            <p className="field-help">视频封面</p>
            <MediaPreview alt={preview.title} mediaId={preview.coverMediaId} />
          </article>
        </div>
      )}
    </section>
  )
}
