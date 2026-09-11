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
import { AdminIcon } from '../components/AdminIcon'
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
  const [coverMediaId, setCoverMediaId] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const blocker = useBlocker(dirty)

  const hydrate = useCallback((next: AdminHomeHeroContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setCoverMediaId(editable?.coverMediaId ?? '')
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
        coverMediaId,
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
    <div className="hero-admin-page">
      <div className="page-heading-row hero-page-heading">
        <div className="hero-page-heading__title">
          <PageIntro title="首页头图管理" description="上传首页第一屏完整图片，小程序将按原始比例等比展示。" />
          <span className={`status-pill ${content?.visibility === 'PUBLISHED' ? 'active' : 'disabled'}`}>
            {content?.visibility === 'PUBLISHED' ? '线上展示中' : '未发布'}
          </span>
        </div>
        <div className="hero-page-actions">
          <button className="secondary-button" disabled={busy || !dirty || !coverMediaId} form="home-hero-form" type="submit">保存草稿</button>
          <button className="primary-button" disabled={busy || dirty || !content?.draft} onClick={() => void publish()} type="button">发布到首页</button>
          {content?.visibility === 'PUBLISHED' && <button className="text-button danger" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>}
        </div>
      </div>
      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}
      <div className="hero-editor-layout">
        <form className="hero-compact-editor" id="home-hero-form" onSubmit={(event) => void save(event)}>
          <div className="compact-editor-heading">
            <span><AdminIcon name="hero" /></span>
            <div>
              <h3>头图内容</h3>
              <p>图片中的品牌文字与画面请在上传前设计完整。</p>
            </div>
          </div>
          <MediaUploadField
            accept="image/jpeg,image/png,image/webp"
            label="头图图片"
            mediaId={coverMediaId || undefined}
            mediaType="IMAGE"
            onReady={(media) => { setCoverMediaId(media.id); setDirty(true) }}
            purpose="HOME_HERO"
          />
          <div className="hero-draft-note">
            <span aria-hidden="true">i</span>
            草稿不会立即影响小程序，发布后才会更新线上头图。
          </div>
        </form>

        <aside className="hero-mini-preview">
          <div className="hero-mini-preview__heading">
            <div><span aria-hidden="true">▯</span><strong>小程序预览</strong></div>
            <small>编辑内容实时预览</small>
          </div>
          <div className="hero-phone-preview">
            <div className="hero-phone-preview__status"><strong>9:41</strong><span>● ◒ ▰</span></div>
            <div className="hero-phone-preview__nav"><strong>常清净文旅投</strong><span>•••　◉</span></div>
            <div className="hero-phone-preview__content">
              <div className={`hero-phone-preview__banner${coverMediaId ? ' has-image' : ''}`}>
                {coverMediaId
                  ? <MediaPreview alt="首页头图预览" mediaId={coverMediaId} />
                  : <span>上传图片后在此预览</span>}
              </div>
              <div className="hero-phone-preview__section-title"><strong>视频介绍</strong><i /></div>
              <div className="hero-phone-preview__video"><AdminIcon name="video" /></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
