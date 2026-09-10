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
import { PageIntro } from '../components/PageIntro'
import { MediaPreview } from '../components/MediaPreview'
import { MediaUploadField } from '../components/MediaUploadField'

interface EditableCompanySection {
  key: string
  title: string
  text: string
}

let sectionSequence = 0

function newSection(title = '', text = ''): EditableCompanySection {
  sectionSequence += 1
  return { key: `company-section-${sectionSequence}`, title, text }
}

function sectionsFromBlocks(blocks: CompanyContentBlock[]): EditableCompanySection[] {
  const sections: EditableCompanySection[] = []
  for (const block of blocks) {
    if (block.type === 'HEADING') {
      sections.push(newSection(block.text ?? ''))
      continue
    }
    if (block.type !== 'PARAGRAPH') continue
    if (sections.length === 0) sections.push(newSection('公司简介'))
    const section = sections[sections.length - 1]
    section.text = [section.text, block.text ?? ''].filter(Boolean).join('\n\n')
  }
  if (sections.length === 0) return [newSection()]
  return sections
}

function blocksFromSections(sections: EditableCompanySection[]): CompanyContentBlock[] {
  return sections.flatMap((section) => [
    { type: 'HEADING' as const, text: section.title },
    { type: 'PARAGRAPH' as const, text: section.text },
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
  const [galleryMediaIds, setGalleryMediaIds] = useState<string[]>([])
  const [galleryUploadKey, setGalleryUploadKey] = useState(0)
  const [sections, setSections] = useState<EditableCompanySection[]>([newSection()])
  const [preview, setPreview] = useState<AdminCompanyRevision>()
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const blocker = useBlocker(dirty)

  const hydrate = useCallback((next: AdminCompanyContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setTitle(editable?.title ?? '')
    setSummary(editable?.summary ?? '')
    setCoverMediaId(editable?.coverMediaId ?? '')
    setGalleryMediaIds(editable?.galleryMediaIds ?? [])
    setSections(sectionsFromBlocks(editable?.blocks ?? []))
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
  }

  function moveGalleryImage(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= galleryMediaIds.length) return
    setGalleryMediaIds((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setDirty(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await saveAdminCompanyDraft({
        title,
        summary,
        coverMediaId: coverMediaId || undefined,
        galleryMediaIds,
        blocks: blocksFromSections(sections),
        expectedVersion: content?.version ?? 0,
      })
      hydrate(saved)
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

  return (
    <>
      <div className="page-heading-row">
        <PageIntro
          title="公司介绍管理"
          description="维护小程序中的公司封面、简介和详细介绍。保存后不会立即影响线上内容，发布后才会更新。"
        />
        <div className="content-status">
          <span className={`status-pill ${content?.visibility === 'PUBLISHED' ? 'active' : 'disabled'}`}>
            {content?.visibility === 'PUBLISHED' ? '线上展示中' : '未发布'}
          </span>
          {hasUnpublishedDraft && <small>有未发布草稿</small>}
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

      <div className="version-grid">
        <section className="version-card">
          <span>当前线上版本</span>
          <strong>{content?.published ? `第 ${content.published.revisionNumber} 版` : '暂无'}</strong>
          <small>{content?.firstPublishedAt ? new Date(content.firstPublishedAt).toLocaleString('zh-CN') : '尚未发布'}</small>
        </section>
        <section className="version-card">
          <span>当前草稿</span>
          <strong>{content?.draft ? `第 ${content.draft.revisionNumber} 版` : '尚未保存'}</strong>
          <small>{dirty ? '有未保存修改' : content?.updatedAt ? new Date(content.updatedAt).toLocaleString('zh-CN') : '可开始编辑'}</small>
        </section>
      </div>

      <form className="content-editor" onSubmit={save}>
        <label className="editor-field">
          标题
          <input
            maxLength={255}
            onChange={(event) => {
              setTitle(event.target.value)
              setDirty(true)
            }}
            placeholder="例如：关于常清净文旅投"
            required
            value={title}
          />
        </label>

        <MediaUploadField
          accept="image/jpeg,image/png,image/webp"
          label="公司介绍列表封面"
          mediaId={coverMediaId || undefined}
          mediaType="IMAGE"
          onReady={(media) => {
            setCoverMediaId(media.id)
            setDirty(true)
          }}
          purpose="COMPANY_COVER"
        />
        <label className="editor-field">
          首页简介
          <textarea
            maxLength={2000}
            onChange={(event) => {
              setSummary(event.target.value)
              setDirty(true)
            }}
            placeholder="用于首页公司介绍卡片的简短说明"
            required
            rows={4}
            value={summary}
          />
        </label>

        <section className="company-gallery-editor" aria-labelledby="company-gallery-title">
          <div className="block-heading">
            <div>
              <h3 id="company-gallery-title">公司详情图片</h3>
              <p>进入公司介绍后展示，可上传多张并调整左右滑动的顺序，最多 10 张。</p>
            </div>
            <span className="gallery-count">已添加 {galleryMediaIds.length} / 10 张</span>
          </div>
          {galleryMediaIds.length > 0 && (
            <div className="company-gallery-list">
              {galleryMediaIds.map((mediaId, imageIndex) => (
                <div className="company-gallery-item" key={mediaId}>
                  <div className="company-gallery-item__toolbar">
                    <strong>详情图片 {imageIndex + 1}</strong>
                    <div className="section-content-actions">
                      <button
                        aria-label={`上移第 ${imageIndex + 1} 张详情图片`}
                        className="icon-text-button"
                        disabled={imageIndex === 0}
                        onClick={() => moveGalleryImage(imageIndex, -1)}
                        type="button"
                      >上移</button>
                      <button
                        aria-label={`下移第 ${imageIndex + 1} 张详情图片`}
                        className="icon-text-button"
                        disabled={imageIndex === galleryMediaIds.length - 1}
                        onClick={() => moveGalleryImage(imageIndex, 1)}
                        type="button"
                      >下移</button>
                      <button
                        aria-label={`删除第 ${imageIndex + 1} 张详情图片`}
                        className="icon-text-button danger"
                        onClick={() => {
                          setGalleryMediaIds((current) => current.filter((_, index) => index !== imageIndex))
                          setDirty(true)
                        }}
                        type="button"
                      >删除</button>
                    </div>
                  </div>
                  <MediaUploadField
                    accept="image/jpeg,image/png,image/webp"
                    label={`详情图片 ${imageIndex + 1}`}
                    mediaId={mediaId}
                    mediaType="IMAGE"
                    onReady={(media) => {
                      setGalleryMediaIds((current) => current.map(
                        (currentId, index) => index === imageIndex ? media.id : currentId,
                      ))
                      setDirty(true)
                    }}
                    purpose="COMPANY_IMAGE"
                  />
                </div>
              ))}
            </div>
          )}
          {galleryMediaIds.length < 10 && (
            <div className="company-gallery-uploader">
              <MediaUploadField
                key={galleryUploadKey}
                accept="image/jpeg,image/png,image/webp"
                label={galleryMediaIds.length === 0 ? '上传第一张详情图片' : '继续添加详情图片'}
                mediaType="IMAGE"
                onReady={(media) => {
                  setGalleryMediaIds((current) => [...current, media.id])
                  setGalleryUploadKey((current) => current + 1)
                  setDirty(true)
                }}
                purpose="COMPANY_IMAGE"
              />
            </div>
          )}
        </section>

        <div className="block-heading">
          <div>
            <h3>公司介绍板块</h3>
            <p>每个板块会按这里的顺序展示在小程序中，例如“公司简介”“企业定位”“核心实力”。</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              setSections((current) => [...current, newSection()])
              setDirty(true)
            }}
            type="button"
          >
            添加板块
          </button>
        </div>

        <div className="company-sections">
          {sections.map((section, sectionIndex) => (
            <section className="company-section-card" key={section.key}>
              <div className="company-section-toolbar">
                <strong>内容板块 {sectionIndex + 1}</strong>
                <span>可调整展示顺序</span>
                <button aria-label={`上移第 ${sectionIndex + 1} 个板块`} className="icon-text-button" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)} type="button">上移</button>
                <button aria-label={`下移第 ${sectionIndex + 1} 个板块`} className="icon-text-button" disabled={sectionIndex === sections.length - 1} onClick={() => moveSection(sectionIndex, 1)} type="button">下移</button>
                <button
                  className="icon-text-button danger"
                  disabled={sections.length === 1}
                  onClick={() => {
                    setSections((current) => current.filter((_, index) => index !== sectionIndex))
                    setDirty(true)
                  }}
                  type="button"
                >
                  删除板块
                </button>
              </div>
              <label className="editor-field">
                板块标题
                <input
                  aria-label={`第 ${sectionIndex + 1} 个板块标题`}
                  maxLength={255}
                  onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}
                  placeholder="例如：企业定位"
                  required
                  value={section.title}
                />
              </label>
              <label className="editor-field">
                文字内容
                <textarea
                  aria-label={`第 ${sectionIndex + 1} 个板块文字内容`}
                  maxLength={10000}
                  onChange={(event) => updateSection(sectionIndex, { text: event.target.value })}
                  placeholder="输入该板块的详细介绍，可使用换行组织段落"
                  required
                  rows={7}
                  value={section.text}
                />
              </label>
            </section>
          ))}
        </div>

        <div className="editor-actions">
          <button className="primary-button" disabled={busy || !dirty} type="submit">
            {busy ? '处理中…' : '保存草稿'}
          </button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">预览草稿</button>
          <button className="secondary-button publish-button" disabled={busy || dirty || !content?.draft} onClick={() => void publish()} type="button">发布</button>
          {content?.visibility === 'PUBLISHED' && (
            <button className="secondary-button danger-button" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>
          )}
        </div>
        {dirty && <p className="unsaved-indicator">修改尚未保存。预览和发布前请先保存草稿。</p>}
      </form>

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
            {Boolean(preview.galleryMediaIds?.length) && (
              <section className="preview-media-section">
                <h3>公司详情图片</h3>
                <div className="preview-gallery">
                  {preview.galleryMediaIds?.map((mediaId, index) => (
                    <MediaPreview alt={`公司详情图片 ${index + 1}`} key={mediaId} mediaId={mediaId} />
                  ))}
                </div>
              </section>
            )}
            <div className="preview-body">
              {preview.blocks.map((block, index) => {
                if (block.type === 'HEADING') return <h3 key={index}>{block.text}</h3>
                if (block.type === 'IMAGE') return null
                return <p key={index}>{block.text}</p>
              })}
            </div>
          </article>
        </div>
      )}
    </>
  )
}
