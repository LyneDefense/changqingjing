import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import {
  AdminApiError,
  getAdminHomeHeroContent,
  publishAdminHomeHero,
  saveAdminHomeHeroDraft,
  unpublishAdminHomeHero,
} from '../api/admin'
import type { AdminHomeHeroContent } from '../api/admin'
import { MediaPreview } from '../components/MediaPreview'
import { MediaUploadField } from '../components/MediaUploadField'
import { PageIntro } from '../components/PageIntro'

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message + (error.traceId ? `（追踪号：${error.traceId}）` : '')
  }
  return '首页头图操作失败，请稍后重试'
}

export function HomeHeroPage() {
  const [content, setContent] = useState<AdminHomeHeroContent>()
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [coverMediaId, setCoverMediaId] = useState('')
  const [focusX, setFocusX] = useState(50)
  const [focusY, setFocusY] = useState(50)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const blocker = useBlocker(dirty)

  const hydrate = useCallback((next: AdminHomeHeroContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setTitle(editable?.title ?? '')
    setSubtitle(editable?.subtitle ?? '')
    setCoverMediaId(editable?.coverMediaId ?? '')
    setFocusX(editable?.focusX ?? 50)
    setFocusY(editable?.focusY ?? 50)
    setDirty(false)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      hydrate(await getAdminHomeHeroContent())
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [hydrate])

  useEffect(() => {
    // Loading the singleton is the effect's synchronization target.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('首页头图还有修改没有保存，确定离开吗？')) blocker.proceed()
    else blocker.reset()
  }, [blocker])
  useBeforeUnload((event) => { if (dirty) event.preventDefault() })

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!coverMediaId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      hydrate(await saveAdminHomeHeroDraft({
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        coverMediaId,
        focusX,
        focusY,
        expectedVersion: content?.version ?? 0,
      }))
      setNotice('草稿已保存，不会立即影响小程序。')
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!content?.draft || dirty) return
    if (!window.confirm('发布后，小程序首页头图会立即更新。确认发布吗？')) return
    setBusy(true)
    try {
      hydrate(await publishAdminHomeHero(content.version))
      setNotice('首页头图已发布。')
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (!content || !window.confirm('下架后，小程序将暂时使用默认品牌头图。确认下架吗？')) return
    setBusy(true)
    try {
      hydrate(await unpublishAdminHomeHero(content.version))
      setNotice('首页头图已下架。')
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="empty-state">正在加载首页头图…</p>

  return (
    <>
      <div className="page-heading-row">
        <PageIntro title="首页头图管理" description="配置首页第一屏图片。主标题和副标题均可不填。" />
        <span className={`status-pill ${content?.visibility === 'PUBLISHED' ? 'active' : 'disabled'}`}>
          {content?.visibility === 'PUBLISHED' ? '线上展示中' : '未发布'}
        </span>
      </div>
      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}
      <form className="content-editor" onSubmit={(event) => void save(event)}>
        <MediaUploadField
          accept="image/jpeg,image/png,image/webp"
          label="头图图片"
          mediaId={coverMediaId || undefined}
          mediaType="IMAGE"
          onReady={(media) => { setCoverMediaId(media.id); setDirty(true) }}
          purpose="HOME_HERO"
        />
        {coverMediaId && (
          <div className="hero-focus-preview">
            <div>
              <strong>首页裁切预览</strong>
              <p className="field-help">拖动下面两个滑块，让人物或主体始终处在画面内。</p>
            </div>
            <MediaPreview mediaId={coverMediaId} objectPosition={`${focusX}% ${focusY}%`} />
          </div>
        )}
        <div className="editor-grid-two">
          <label className="editor-field">图片主体的左右位置：{focusX}%<input type="range" min="0" max="100" value={focusX} onChange={(event) => { setFocusX(Number(event.target.value)); setDirty(true) }} /></label>
          <label className="editor-field">图片主体的上下位置：{focusY}%<input type="range" min="0" max="100" value={focusY} onChange={(event) => { setFocusY(Number(event.target.value)); setDirty(true) }} /></label>
        </div>
        <label className="editor-field">主标题（选填）<input maxLength={100} value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true) }} /></label>
        <label className="editor-field">副标题（选填）<textarea maxLength={200} rows={3} value={subtitle} onChange={(event) => { setSubtitle(event.target.value); setDirty(true) }} /></label>
        <div className="editor-actions">
          <button className="primary-button" disabled={busy || !dirty || !coverMediaId} type="submit">保存草稿</button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void publish()} type="button">发布到首页</button>
          {content?.visibility === 'PUBLISHED' && <button className="secondary-button danger-button" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>}
        </div>
      </form>
    </>
  )
}
