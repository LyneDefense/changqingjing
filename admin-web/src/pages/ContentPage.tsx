import { useCallback, useEffect, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import type { FormEvent } from 'react'
import {
  AdminApiError,
  getAdminCompanyContent,
  previewAdminCompanyDraft,
  publishAdminCompany,
  saveAdminCompanyDraft,
  unpublishAdminCompany,
} from '../api/admin'
import type {
  AdminCompanyContent,
  AdminCompanyRevision,
  CompanyContentBlock,
} from '../api/admin'
import { AdminIcon } from '../components/AdminIcon'
import { PageIntro } from '../components/PageIntro'
import { MediaPreview } from '../components/MediaPreview'
import { MediaUploadField } from '../components/MediaUploadField'

interface EditableCompanySection {
  key: string
  title: string
  text: string
  imageMediaIds: string[]
}

type CompanyEditorPanel = 'BASIC' | 'SECTIONS'
type CompanyPreviewMode = 'HOME' | 'DETAIL'

let sectionSequence = 0

function newSection(title = '', text = '', imageMediaIds: string[] = []): EditableCompanySection {
  sectionSequence += 1
  return { key: `company-section-${sectionSequence}`, title, text, imageMediaIds }
}

function sectionsFromBlocks(
  blocks: CompanyContentBlock[],
  legacyGalleryMediaIds: string[] = [],
): EditableCompanySection[] {
  const sections: EditableCompanySection[] = []
  for (const block of blocks) {
    if (block.type === 'HEADING') {
      sections.push(newSection(block.text ?? ''))
      continue
    }
    if (block.type === 'PARAGRAPH') {
      if (sections.length === 0) sections.push(newSection('公司简介'))
      const section = sections[sections.length - 1]
      section.text = [section.text, block.text ?? ''].filter(Boolean).join('\n\n')
      continue
    }
    if (block.type === 'IMAGE' && block.mediaId) {
      if (sections.length === 0) sections.push(newSection('公司简介'))
      sections[sections.length - 1].imageMediaIds.push(block.mediaId)
    }
  }
  if (sections.length === 0) return [newSection()]
  if (legacyGalleryMediaIds.length > 0) {
    sections[0].imageMediaIds.push(...legacyGalleryMediaIds)
  }
  return sections
}

function blocksFromSections(sections: EditableCompanySection[]): CompanyContentBlock[] {
  return sections.flatMap((section) => [
    { type: 'HEADING' as const, text: section.title },
    { type: 'PARAGRAPH' as const, text: section.text },
    ...section.imageMediaIds.map((mediaId, index) => ({
      type: 'IMAGE' as const,
      mediaId,
      altText: `${section.title} 图片 ${index + 1}`,
    })),
  ])
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return `${error.message}${error.traceId ? `（追踪号：${error.traceId}）` : ''}`
  }
  return '操作失败，请稍后重试'
}

export function ContentPage() {
  const [content, setContent] = useState<AdminCompanyContent>()
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [coverMediaId, setCoverMediaId] = useState('')
  const [sectionImageUploadKey, setSectionImageUploadKey] = useState(0)
  const [sections, setSections] = useState<EditableCompanySection[]>([newSection()])
  const [preview, setPreview] = useState<AdminCompanyRevision>()
  const [activePanel, setActivePanel] = useState<CompanyEditorPanel>('BASIC')
  const [previewMode, setPreviewMode] = useState<CompanyPreviewMode>('HOME')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const blocker = useBlocker(dirty)

  const hydrate = useCallback((next: AdminCompanyContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setTitle(editable?.title ?? '')
    setSummary(editable?.summary ?? '')
    setCoverMediaId(editable?.coverMediaId ?? '')
    setSections(sectionsFromBlocks(
      editable?.blocks ?? [],
      editable?.galleryMediaIds ?? [],
    ))
    setDirty(false)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      hydrate(await getAdminCompanyContent())
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

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('当前修改尚未保存，确定离开吗？')) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker])

  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault()
    }
  })

  function updateSection(index: number, patch: Partial<EditableCompanySection>) {
    setSections((current) => current.map(
      (section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section,
    ))
    setDirty(true)
    setNotice('')
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    setSections((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setDirty(true)
    setNotice('')
  }

  function updateSectionImages(
    sectionIndex: number,
    update: (imageMediaIds: string[]) => string[],
  ) {
    setSections((current) => current.map((section, index) => index === sectionIndex
      ? { ...section, imageMediaIds: update(section.imageMediaIds) }
      : section))
    setDirty(true)
    setNotice('')
  }

  function moveSectionImage(sectionIndex: number, imageIndex: number, direction: -1 | 1) {
    updateSectionImages(sectionIndex, (current) => {
      const target = imageIndex + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[imageIndex], next[target]] = [next[target], next[imageIndex]]
      return next
    })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !summary.trim()) {
      setActivePanel('BASIC')
      setError('请先填写首页标题和简介。')
      return
    }
    if (sections.some((section) => !section.title.trim() || !section.text.trim())) {
      setActivePanel('SECTIONS')
      setError('每个公司介绍板块都需要填写标题和文字内容。')
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = await saveAdminCompanyDraft({
        title,
        summary,
        coverMediaId: coverMediaId || undefined,
        galleryMediaIds: [],
        blocks: blocksFromSections(sections),
        expectedVersion: content?.version ?? 0,
      })
      hydrate(saved)
      setNotice('草稿已保存，不会立即影响小程序。')
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
      setPreview(await previewAdminCompanyDraft())
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
      hydrate(await publishAdminCompany(content.version))
      setNotice('公司介绍已发布。')
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (!content || !window.confirm('确认下架公司介绍吗？公开首页将立即隐藏此内容。')) {
      return
    }
    setBusy(true)
    setError('')
    try {
      hydrate(await unpublishAdminCompany(content.version))
      setNotice('公司介绍已下架。')
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="empty-state">正在加载公司介绍…</p>
  }

  const hasUnpublishedDraft = Boolean(
    content?.draft && content.draft.id !== content.published?.id,
  )
  const totalSectionImages = sections.reduce(
    (total, section) => total + section.imageMediaIds.length,
    0,
  )

  return (
    <div className="company-admin-page">
      <div className="page-heading-row company-page-heading">
        <div className="company-page-heading__title">
          <PageIntro
            title="公司介绍管理"
            description="维护首页卡片与详情内容；插图跟随所属文字板块一起展示。"
          />
          <span className={`status-pill ${content?.visibility === 'PUBLISHED' ? 'active' : 'disabled'}`}>
            {content?.visibility === 'PUBLISHED' ? '线上展示中' : '未发布'}
          </span>
          {hasUnpublishedDraft && <small className="company-draft-badge">有未发布草稿</small>}
        </div>
        <div className="company-page-actions">
          <button className="secondary-button" disabled={busy || !dirty} form="company-content-form" type="submit">
            {busy ? '处理中…' : '保存草稿'}
          </button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">预览草稿</button>
          <button className="primary-button" disabled={busy || dirty || !content?.draft} onClick={() => void publish()} type="button">发布</button>
          {content?.visibility === 'PUBLISHED' && (
            <button className="text-button danger" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>
          )}
        </div>
      </div>

      {error && (
        <div className="notice error-notice content-error" role="alert">
          <span>{error}</span>
          {error.includes('其他人员修改') && (
            <button className="text-button" onClick={() => void load()} type="button">重新加载</button>
          )}
        </div>
      )}
      {notice && <div className="notice success-notice">{notice}</div>}

      <div className="company-editor-layout">
        <form className="company-compact-editor" id="company-content-form" onSubmit={save}>
          <div className="company-editor-tabs" role="tablist" aria-label="公司介绍编辑内容">
            <button aria-selected={activePanel === 'BASIC'} className={activePanel === 'BASIC' ? 'active' : ''} onClick={() => setActivePanel('BASIC')} role="tab" type="button">
              基础信息
            </button>
            <button aria-selected={activePanel === 'SECTIONS'} className={activePanel === 'SECTIONS' ? 'active' : ''} onClick={() => setActivePanel('SECTIONS')} role="tab" type="button">
              详情内容 <span>{sections.length}</span>
            </button>
          </div>

          <div className="company-version-strip">
            <span><small>线上版本</small><strong>{content?.published ? `第 ${content.published.revisionNumber} 版` : '暂无'}</strong></span>
            <i />
            <span><small>当前草稿</small><strong>{content?.draft ? `第 ${content.draft.revisionNumber} 版` : '尚未保存'}</strong></span>
            <i />
            <span><small>最近更新</small><strong>{content?.updatedAt ? new Date(content.updatedAt).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</strong></span>
          </div>

          {activePanel === 'BASIC' && (
            <section className="company-editor-panel" aria-labelledby="company-basic-title">
              <div className="compact-editor-heading">
                <span><AdminIcon name="company" /></span>
                <div><h3 id="company-basic-title">首页卡片</h3><p>维护首页公司介绍卡片中的标题、简介和封面。</p></div>
              </div>
              <label className="editor-field company-inline-field">
                <span>标题</span>
                <input
                  aria-label="标题"
                  maxLength={255}
                  onChange={(event) => { setTitle(event.target.value); setDirty(true); setNotice('') }}
                  placeholder="例如：公司介绍"
                  required
                  value={title}
                />
              </label>
              <label className="editor-field company-inline-field company-summary-field">
                <span>首页简介</span>
                <textarea
                  aria-label="首页简介"
                  maxLength={2000}
                  onChange={(event) => { setSummary(event.target.value); setDirty(true); setNotice('') }}
                  placeholder="用于首页公司介绍卡片的简短说明"
                  required
                  rows={3}
                  value={summary}
                />
              </label>
              <div className="company-cover-field">
                <MediaUploadField
                  accept="image/jpeg,image/png,image/webp"
                  label="公司介绍列表封面"
                  mediaId={coverMediaId || undefined}
                  mediaType="IMAGE"
                  onReady={(media) => { setCoverMediaId(media.id); setDirty(true); setNotice('') }}
                  purpose="COMPANY_COVER"
                />
              </div>
            </section>
          )}

          {activePanel === 'SECTIONS' && (
            <section className="company-editor-panel" aria-labelledby="company-sections-title">
              <div className="company-panel-heading">
                <div className="compact-editor-heading">
                  <span><AdminIcon name="company" /></span>
                  <div><h3 id="company-sections-title">详情内容</h3><p>每个板块包含标题、文字和可选插图，可调整展示顺序。</p></div>
                </div>
                <div className="company-panel-actions">
                  <span className="gallery-count">共 {totalSectionImages} / 10 张插图</span>
                  <button aria-label="添加板块" className="secondary-button" onClick={() => { setSections((current) => [...current, newSection()]); setDirty(true); setNotice('') }} type="button">＋ 添加板块</button>
                </div>
              </div>
              <div className="company-sections">
                {sections.map((section, sectionIndex) => (
                  <section className="company-section-card" key={section.key}>
                    <div className="company-section-toolbar">
                      <strong>板块 {String(sectionIndex + 1).padStart(2, '0')}</strong>
                      <span>{section.title || '未命名板块'}</span>
                      <button aria-label={`上移第 ${sectionIndex + 1} 个板块`} className="icon-text-button" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)} type="button">上移</button>
                      <button aria-label={`下移第 ${sectionIndex + 1} 个板块`} className="icon-text-button" disabled={sectionIndex === sections.length - 1} onClick={() => moveSection(sectionIndex, 1)} type="button">下移</button>
                      <button className="icon-text-button danger" disabled={sections.length === 1} onClick={() => { setSections((current) => current.filter((_, index) => index !== sectionIndex)); setDirty(true); setNotice('') }} type="button">删除</button>
                    </div>
                    <div className="company-section-fields">
                      <label className="editor-field">
                        板块标题
                        <input aria-label={`第 ${sectionIndex + 1} 个板块标题`} maxLength={255} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} placeholder="例如：企业定位" required value={section.title} />
                      </label>
                      <label className="editor-field">
                        文字内容
                        <textarea aria-label={`第 ${sectionIndex + 1} 个板块文字内容`} maxLength={10000} onChange={(event) => updateSection(sectionIndex, { text: event.target.value })} placeholder="输入该板块的详细介绍，可使用换行组织段落" required rows={5} value={section.text} />
                      </label>
                    </div>
                    <div className="company-section-images">
                      <div className="company-section-images__heading">
                        <div><strong>内容插图</strong><span>可选，跟随本板块文字一起展示</span></div>
                        <small>{section.imageMediaIds.length} 张</small>
                      </div>
                      {section.imageMediaIds.length > 0 && (
                        <div className="company-section-image-list">
                          {section.imageMediaIds.map((mediaId, imageIndex) => (
                            <div className="company-section-image-item" key={mediaId}>
                              <div className="company-gallery-item__toolbar">
                                <strong>插图 {imageIndex + 1}</strong>
                                <div className="section-content-actions">
                                  <button aria-label={`上移第 ${sectionIndex + 1} 个板块的第 ${imageIndex + 1} 张插图`} className="icon-text-button" disabled={imageIndex === 0} onClick={() => moveSectionImage(sectionIndex, imageIndex, -1)} type="button">上移</button>
                                  <button aria-label={`下移第 ${sectionIndex + 1} 个板块的第 ${imageIndex + 1} 张插图`} className="icon-text-button" disabled={imageIndex === section.imageMediaIds.length - 1} onClick={() => moveSectionImage(sectionIndex, imageIndex, 1)} type="button">下移</button>
                                  <button aria-label={`删除第 ${sectionIndex + 1} 个板块的第 ${imageIndex + 1} 张插图`} className="icon-text-button danger" onClick={() => updateSectionImages(sectionIndex, (current) => current.filter((_, index) => index !== imageIndex))} type="button">删除</button>
                                </div>
                              </div>
                              <MediaUploadField
                                accept="image/jpeg,image/png,image/webp"
                                label={`板块 ${sectionIndex + 1} 插图 ${imageIndex + 1}`}
                                mediaId={mediaId}
                                mediaType="IMAGE"
                                onReady={(media) => updateSectionImages(sectionIndex, (current) => current.map((currentId, index) => index === imageIndex ? media.id : currentId))}
                                purpose="COMPANY_IMAGE"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {totalSectionImages < 10 && (
                        <div className="company-section-image-uploader">
                          <MediaUploadField
                            key={`${section.key}-${sectionImageUploadKey}`}
                            accept="image/jpeg,image/png,image/webp"
                            label="添加插图（可选）"
                            mediaType="IMAGE"
                            onReady={(media) => {
                              updateSectionImages(sectionIndex, (current) => [...current, media.id])
                              setSectionImageUploadKey((current) => current + 1)
                            }}
                            purpose="COMPANY_IMAGE"
                          />
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          )}

          <div className="hero-draft-note">
            <span aria-hidden="true">i</span>
            {dirty ? '修改尚未保存。预览和发布前请先保存草稿。' : '草稿不会影响小程序，发布后才会更新线上公司介绍。'}
          </div>
        </form>

        <aside className="company-mini-preview">
          <div className="company-preview-heading">
            <div><span aria-hidden="true">▯</span><strong>小程序预览</strong></div>
            <div className="company-preview-switch" role="group" aria-label="预览页面">
              <button className={previewMode === 'HOME' ? 'active' : ''} onClick={() => setPreviewMode('HOME')} type="button">首页卡片</button>
              <button className={previewMode === 'DETAIL' ? 'active' : ''} onClick={() => setPreviewMode('DETAIL')} type="button">详情页</button>
            </div>
          </div>
          <div className="hero-phone-preview company-phone-preview">
            <div className="hero-phone-preview__status"><strong>9:41</strong><span>● ◒ ▰</span></div>
            <div className="hero-phone-preview__nav"><strong>{previewMode === 'HOME' ? '常清净文旅投' : '公司介绍'}</strong><span>•••　◉</span></div>
            {previewMode === 'HOME' ? (
              <div className="company-home-preview">
                <div className="company-home-preview__hero" />
                <div className="hero-phone-preview__section-title"><strong>视频介绍</strong><i /></div>
                <div className="company-home-preview__video"><AdminIcon name="video" /></div>
                <div className={`company-home-preview__card${coverMediaId ? '' : ' text-only'}`}>
                  <div><strong>{title || '公司介绍'}</strong><small>{summary || '填写首页简介后在此预览'}</small><span>了解我们　→</span></div>
                  {coverMediaId && <MediaPreview alt="公司介绍列表封面预览" mediaId={coverMediaId} />}
                </div>
              </div>
            ) : (
              <div className="company-detail-preview">
                <div className="company-detail-preview__body">
                  {sections.slice(0, 3).map((section) => (
                    <div className="company-detail-preview__section" key={section.key}>
                      <div><i /><strong>{section.title || '板块标题'}</strong><span /></div>
                      <p>{section.text || '板块文字内容将在这里展示。'}</p>
                      {section.imageMediaIds.map((mediaId, index) => (
                        <MediaPreview alt={`${section.title || '板块'}插图 ${index + 1}`} key={mediaId} mediaId={mediaId} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {preview && (
        <div className="modal-backdrop" role="presentation">
          <article aria-labelledby="preview-title" aria-modal="true" className="modal-card content-preview" role="dialog">
            <div className="modal-header">
              <div>
                <p className="eyebrow">草稿预览 · 第 {preview.revisionNumber} 版</p>
                <h2 id="preview-title">{preview.title}</h2>
              </div>
              <button aria-label="关闭预览" className="icon-button" onClick={() => setPreview(undefined)} type="button">×</button>
            </div>
            <p className="preview-summary">{preview.summary}</p>
            {preview.coverMediaId && (
              <section className="preview-media-section">
                <h3>首页列表封面</h3>
                <MediaPreview alt={preview.title} mediaId={preview.coverMediaId} />
              </section>
            )}
            <div className="preview-body">
              {preview.blocks.map((block, index) => {
                if (block.type === 'HEADING') return <h3 key={index}>{block.text}</h3>
                if (block.type === 'IMAGE' && block.mediaId) {
                  return <MediaPreview alt={block.altText || `公司介绍插图 ${index + 1}`} key={index} mediaId={block.mediaId} />
                }
                return <p key={index}>{block.text}</p>
              })}
            </div>
          </article>
        </div>
      )}
    </div>
  )
}
