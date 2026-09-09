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
  const [blocks, setBlocks] = useState<CompanyContentBlock[]>([{ ...blankBlock }])
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
    setBlocks(editable?.blocks.length ? editable.blocks : [{ ...blankBlock }])
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

  function updateBlock(index: number, patch: Partial<CompanyContentBlock>) {
    setBlocks((current) => current.map(
      (block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block,
    ))
    setDirty(true)
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    setBlocks((current) => {
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
        blocks,
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
            <h3>详情内容</h3>
            <p>按阅读顺序添加小标题和正文段落。</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              setBlocks((current) => [...current, { ...blankBlock }])
              setDirty(true)
            }}
            type="button"
          >
            添加内容块
          </button>
        </div>

        <div className="content-blocks">
          {blocks.map((block, index) => (
            <section className="content-block" key={index}>
              <div className="block-toolbar">
                <select
                  aria-label={`第 ${index + 1} 块类型`}
                  onChange={(event) => {
                    const type = event.target.value as CompanyContentBlock['type']
                    updateBlock(index, type === 'IMAGE'
                      ? { type, text: undefined, mediaId: undefined, altText: '' }
                      : { type, text: block.text ?? '', mediaId: undefined, altText: undefined })
                  }}
                  value={block.type}
                >
                  <option value="PARAGRAPH">正文段落</option>
                  <option value="HEADING">小标题</option>
                  <option value="IMAGE">图片</option>
                </select>
                <span>第 {index + 1} 块</span>
                <button aria-label="上移" className="icon-text-button" disabled={index === 0} onClick={() => moveBlock(index, -1)} type="button">↑</button>
                <button aria-label="下移" className="icon-text-button" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} type="button">↓</button>
                <button
                  className="icon-text-button danger"
                  disabled={blocks.length === 1}
                  onClick={() => {
                    setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index))
                    setDirty(true)
                  }}
                  type="button"
                >
                  删除
                </button>
              </div>
              {block.type === 'IMAGE' ? (
                <>
                  <MediaUploadField
                    accept="image/jpeg,image/png,image/webp"
                    label={`正文图片 ${index + 1}`}
                    mediaId={block.mediaId}
                    mediaType="IMAGE"
                    onReady={(media) => updateBlock(index, { mediaId: media.id })}
                    purpose="COMPANY_IMAGE"
                  />
                  <input
                    aria-label={`第 ${index + 1} 块图片说明`}
                    maxLength={255}
                    onChange={(event) => updateBlock(index, { altText: event.target.value })}
                    placeholder="图片说明（便于无障碍阅读）"
                    value={block.altText ?? ''}
                  />
                </>
              ) : (
                <textarea
                  aria-label={`第 ${index + 1} 块内容`}
                  maxLength={10000}
                  onChange={(event) => updateBlock(index, { text: event.target.value })}
                  placeholder={block.type === 'HEADING' ? '输入小标题' : '输入正文段落'}
                  required
                  rows={block.type === 'HEADING' ? 2 : 6}
                  value={block.text ?? ''}
                />
              )}
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
