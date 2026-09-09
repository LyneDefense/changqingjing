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

const blankBlock: CompanyContentBlock = { type: 'PARAGRAPH', text: '' }

interface EditableCompanySection {
  key: string
  title: string
  content: CompanyContentBlock[]
}

let sectionSequence = 0

function newSection(title = '', content: CompanyContentBlock[] = [{ ...blankBlock }]): EditableCompanySection {
  sectionSequence += 1
  return { key: `company-section-${sectionSequence}`, title, content }
}

function sectionsFromBlocks(blocks: CompanyContentBlock[]): EditableCompanySection[] {
  const sections: EditableCompanySection[] = []
  for (const block of blocks) {
    if (block.type === 'HEADING') {
      sections.push(newSection(block.text ?? '', []))
      continue
    }
    if (sections.length === 0) sections.push(newSection('公司简介', []))
    sections[sections.length - 1].content.push(block)
  }
  if (sections.length === 0) return [newSection()]
  return sections.map((section) => (
    section.content.length > 0 ? section : { ...section, content: [{ ...blankBlock }] }
  ))
}

function blocksFromSections(sections: EditableCompanySection[]): CompanyContentBlock[] {
  return sections.flatMap((section) => [
    { type: 'HEADING' as const, text: section.title },
    ...section.content,
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

  function updateSectionContent(
    sectionIndex: number,
    contentIndex: number,
    patch: Partial<CompanyContentBlock>,
  ) {
    setSections((current) => current.map((section, currentSectionIndex) => (
      currentSectionIndex === sectionIndex
        ? {
            ...section,
            content: section.content.map((block, currentContentIndex) => (
              currentContentIndex === contentIndex ? { ...block, ...patch } : block
            )),
          }
        : section
    )))
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

  function moveSectionContent(sectionIndex: number, contentIndex: number, direction: -1 | 1) {
    const target = contentIndex + direction
    const section = sections[sectionIndex]
    if (!section || target < 0 || target >= section.content.length) return
    const content = [...section.content]
    ;[content[contentIndex], content[target]] = [content[target], content[contentIndex]]
    updateSection(sectionIndex, { content })
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
              <div className="section-content-list">
                {section.content.map((block, contentIndex) => (
                  <div className="section-content-item" key={contentIndex}>
                    <div className="section-content-item__heading">
                      <span>{block.type === 'IMAGE' ? '板块图片' : '文字内容'} {contentIndex + 1}</span>
                      <div className="section-content-actions">
                        <button aria-label={`上移第 ${sectionIndex + 1} 个板块的第 ${contentIndex + 1} 项内容`} className="icon-text-button" disabled={contentIndex === 0} onClick={() => moveSectionContent(sectionIndex, contentIndex, -1)} type="button">上移</button>
                        <button aria-label={`下移第 ${sectionIndex + 1} 个板块的第 ${contentIndex + 1} 项内容`} className="icon-text-button" disabled={contentIndex === section.content.length - 1} onClick={() => moveSectionContent(sectionIndex, contentIndex, 1)} type="button">下移</button>
                        <button
                          className="icon-text-button danger"
                          disabled={section.content.length === 1}
                          onClick={() => updateSection(sectionIndex, {
                            content: section.content.filter((_, index) => index !== contentIndex),
                          })}
                          type="button"
                        >删除</button>
                      </div>
                    </div>
                    {block.type === 'IMAGE' ? (
                      <>
                        <MediaUploadField
                          accept="image/jpeg,image/png,image/webp"
                          label={`第 ${sectionIndex + 1} 个板块图片 ${contentIndex + 1}`}
                          mediaId={block.mediaId}
                          mediaType="IMAGE"
                          onReady={(media) => updateSectionContent(sectionIndex, contentIndex, { mediaId: media.id })}
                          purpose="COMPANY_IMAGE"
                        />
                        <input
                          aria-label={`第 ${sectionIndex + 1} 个板块第 ${contentIndex + 1} 张图片说明`}
                          maxLength={255}
                          onChange={(event) => updateSectionContent(sectionIndex, contentIndex, { altText: event.target.value })}
                          placeholder="图片说明（选填）"
                          value={block.altText ?? ''}
                        />
                      </>
                    ) : (
                      <textarea
                        aria-label={`第 ${sectionIndex + 1} 个板块第 ${contentIndex + 1} 段内容`}
                        maxLength={10000}
                        onChange={(event) => updateSectionContent(sectionIndex, contentIndex, { text: event.target.value })}
                        placeholder="输入该板块的详细介绍"
                        required
                        rows={6}
                        value={block.text ?? ''}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="section-add-actions">
                <button className="secondary-button" onClick={() => updateSection(sectionIndex, {
                  content: [...section.content, { ...blankBlock }],
                })} type="button">添加一段文字</button>
                <button className="secondary-button" onClick={() => updateSection(sectionIndex, {
                  content: [...section.content, { type: 'IMAGE', altText: '' }],
                })} type="button">添加一张图片</button>
              </div>
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
            <MediaPreview alt={preview.title} mediaId={preview.coverMediaId} />
            <div className="preview-body">
              {preview.blocks.map((block, index) => {
                if (block.type === 'HEADING') return <h3 key={index}>{block.text}</h3>
                if (block.type === 'IMAGE') return <MediaPreview alt={block.altText} key={index} mediaId={block.mediaId} />
                return <p key={index}>{block.text}</p>
              })}
            </div>
          </article>
        </div>
      )}
    </>
  )
}
