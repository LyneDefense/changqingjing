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
import { AdminIcon } from './AdminIcon'
import { MediaPreview } from './MediaPreview'
import { MediaUploadField } from './MediaUploadField'
import { PageIntro } from './PageIntro'

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
    <section className="video-editor-page">
      <div className="page-heading-row video-editor-heading">
        <div className="video-editor-heading__title">
          <button className="video-editor-back" onClick={closeEditor} type="button" aria-label="返回视频列表">←</button>
          <PageIntro
            title={entryId ? '编辑宣传视频' : '新增宣传视频'}
            description="上传视频与首页封面，保存草稿后再核对发布。"
          />
          <span className={'status-pill ' + (content?.visibility === 'PUBLISHED' ? 'active' : 'disabled')}>
            {content?.visibility === 'PUBLISHED' ? '首页展示中' : content?.firstPublishedAt ? '已下架' : '草稿'}
          </span>
        </div>
        <div className="video-page-actions">
          <button className="secondary-button" disabled={busy || !dirty || !videoMediaId || !coverMediaId} form="home-video-form" type="submit">
            {busy ? '处理中…' : '保存草稿'}
          </button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">播放预览</button>
          <button className="primary-button" disabled={busy || dirty || !content?.draft} onClick={() => void publish()} type="button">发布到首页</button>
          {content?.visibility === 'PUBLISHED' && (
            <button className="text-button danger" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>
          )}
        </div>
      </div>
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      {notice && <div className="notice success-notice">{notice}</div>}
      <div className="video-editor-layout">
        <form className="video-compact-editor" id="home-video-form" onSubmit={save}>
          <div className="compact-editor-heading">
            <span><AdminIcon name="video" /></span>
            <div>
              <h3>视频内容</h3>
              <p>视频与封面均为首页展示所需内容。</p>
            </div>
          </div>
          <label className="editor-field video-title-field">
            <span>视频标题</span>
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
          <div className="video-media-fields">
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
          <div className="hero-draft-note">
            <span aria-hidden="true">i</span>
            {dirty ? '修改尚未保存，请先保存草稿。' : '草稿不会影响小程序，发布后才会替换当前首页视频。'}
          </div>
        </form>

        <aside className="video-mini-preview">
          <div className="hero-mini-preview__heading">
            <div><span aria-hidden="true">▯</span><strong>小程序预览</strong></div>
            <small>首页封面实时预览</small>
          </div>
          <div className="hero-phone-preview video-phone-preview">
            <div className="hero-phone-preview__status"><strong>9:41</strong><span>● ◒ ▰</span></div>
            <div className="hero-phone-preview__nav"><strong>常清净文旅投</strong><span>•••　◉</span></div>
            <div className="hero-phone-preview__content video-phone-preview__content">
              <div className="hero-phone-preview__section-title"><strong>视频介绍</strong><i /></div>
              <div className={`video-phone-preview__cover${coverMediaId ? ' has-image' : ''}`}>
                {coverMediaId
                  ? <MediaPreview alt={title || '宣传视频封面'} mediaId={coverMediaId} />
                  : <span>上传封面后在此预览</span>}
                <span className="video-phone-preview__play" aria-hidden="true">▶</span>
              </div>
              <div className="video-phone-preview__company">
                <div><strong>公司介绍</strong><small>深耕文旅，筑就清净生态</small></div>
                <span aria-hidden="true" />
              </div>
            </div>
          </div>
        </aside>
      </div>
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
