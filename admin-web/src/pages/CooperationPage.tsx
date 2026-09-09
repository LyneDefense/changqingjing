import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import {
  AdminApiError,
  getAdminCooperationContent,
  previewAdminCooperation,
  publishAdminCooperation,
  saveAdminCooperationDraft,
  unpublishAdminCooperation,
} from '../api/admin'
import type {
  AdminCooperationContent,
  AdminCooperationRevision,
  CooperationRevenueSection,
  CooperationValueSection,
} from '../api/admin'
import { MediaPreview } from '../components/MediaPreview'
import { MediaUploadField } from '../components/MediaUploadField'
import { PageIntro } from '../components/PageIntro'

const initialRevenueSections: CooperationRevenueSection[] = [
  ['招商收益', '💼'],
  ['招募收益', '👥'],
  ['基础业务', '🏯'],
  ['供应链', '📦'],
  ['衍生业务', '🎁'],
  ['特色服务', '🔮'],
  ['增项板块', '🙏'],
].map(([title, icon], index) => ({ title, icon, description: '', displayOrder: index }))

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message + (error.traceId ? `（追踪号：${error.traceId}）` : '')
  }
  return '合作权益操作失败，请稍后重试'
}

export function CooperationPage() {
  const [content, setContent] = useState<AdminCooperationContent>()
  const [title, setTitle] = useState('合作权益')
  const [summary, setSummary] = useState('')
  const [revenueSections, setRevenueSections] = useState(initialRevenueSections)
  const [valueSections, setValueSections] = useState<CooperationValueSection[]>([])
  const [preview, setPreview] = useState<AdminCooperationRevision>()
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const blocker = useBlocker(dirty)

  const markDirty = useCallback(() => setDirty(true), [])

  const hydrate = useCallback((next: AdminCooperationContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setTitle(editable?.title ?? '合作权益')
    setSummary(editable?.summary ?? '')
    setRevenueSections(editable?.revenueSections.length
      ? editable.revenueSections
      : initialRevenueSections)
    setValueSections(editable?.valueSections ?? [])
    setDirty(false)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      hydrate(await getAdminCooperationContent())
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [hydrate])

  useEffect(() => {
    // The page content is synchronized with its singleton backend record.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('合作权益还有修改没有保存，确定离开吗？')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useBeforeUnload((event) => {
    if (dirty) event.preventDefault()
  })

  const publicationProblems = useMemo(() => {
    const problems: string[] = []
    if (!title.trim()) problems.push('填写页面标题')
    if (!summary.trim()) problems.push('填写页面简介')
    if (revenueSections.length === 0) problems.push('添加核心收益分类')
    if (revenueSections.some((item) => !item.title.trim() || !item.description.trim() || !item.icon.trim())) {
      problems.push('补全收益分类的名称、说明和图标')
    }
    if (valueSections.length === 0) problems.push('添加合作价值分类')
    if (valueSections.some((item) => !item.title.trim() || !item.description.trim())) {
      problems.push('补全合作价值的分类名称和详情')
    }
    return problems
  }, [revenueSections, summary, title, valueSections])

  function updateRevenue(index: number, patch: Partial<CooperationRevenueSection>) {
    setRevenueSections((current) => current.map(
      (item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item,
    ))
    markDirty()
  }

  function updateValue(index: number, patch: Partial<CooperationValueSection>) {
    setValueSections((current) => current.map(
      (item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item,
    ))
    markDirty()
  }

  function moveRevenue(index: number, direction: -1 | 1) {
    setRevenueSections((current) => moveItem(current, index, direction))
    markDirty()
  }

  function moveValue(index: number, direction: -1 | 1) {
    setValueSections((current) => moveItem(current, index, direction))
    markDirty()
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await saveAdminCooperationDraft({
        title,
        summary,
        revenueSections: revenueSections.map((item, index) => ({ ...item, displayOrder: index })),
        valueSections: valueSections.map((item, index) => ({ ...item, displayOrder: index })),
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
      setPreview(await previewAdminCooperation())
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!content?.draft || dirty || publicationProblems.length > 0) return
    if (!window.confirm('发布后，小程序“合作权益”会立即展示这份内容。确认发布吗？')) return
    setBusy(true)
    setError('')
    try {
      hydrate(await publishAdminCooperation(content.version))
      setNotice('合作权益已发布。')
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (!content || !window.confirm('下架后，小程序将隐藏合作权益正文。确认下架吗？')) return
    setBusy(true)
    setError('')
    try {
      hydrate(await unpublishAdminCooperation(content.version))
      setNotice('合作权益已下架。')
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="empty-state">正在加载合作权益…</p>

  return (
    <>
      <div className="page-heading-row">
        <PageIntro title="收益板块管理" description="维护小程序合作权益中的核心收益来源和合作价值。" />
        <div className="content-status">
          <span className={`status-pill ${content?.visibility === 'PUBLISHED' ? 'active' : 'disabled'}`}>
            {content?.visibility === 'PUBLISHED' ? '已发布' : '未发布'}
          </span>
          {content?.draft && content.published?.id !== content.draft.id && <small>有未发布修改</small>}
        </div>
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}

      <form className="content-editor" onSubmit={(event) => void save(event)}>
        <div className="editor-section-heading">
          <span>1</span>
          <div><h3>页面信息</h3><p>小程序合作权益页顶部显示的标题和简介。</p></div>
        </div>
        <label className="editor-field">
          页面标题
          <input maxLength={100} required value={title} onChange={(event) => {
            setTitle(event.target.value)
            markDirty()
          }} />
        </label>
        <label className="editor-field">
          页面简介
          <textarea maxLength={500} required rows={3} value={summary} onChange={(event) => {
            setSummary(event.target.value)
            markDirty()
          }} />
        </label>

        <div className="editor-section-heading">
          <span>2</span>
          <div><h3>核心收益来源</h3><p>每张卡片可编辑图标、分类名称和说明，并可调整顺序。</p></div>
        </div>
        <div className="cooperation-editor-list">
          {revenueSections.map((item, index) => (
            <div className="cooperation-editor-card" key={index}>
              <div className="cooperation-editor-toolbar">
                <strong>收益分类 {index + 1}</strong>
                <button className="icon-text-button" disabled={index === 0} onClick={() => moveRevenue(index, -1)} type="button">上移</button>
                <button className="icon-text-button" disabled={index === revenueSections.length - 1} onClick={() => moveRevenue(index, 1)} type="button">下移</button>
                <button className="icon-text-button danger" onClick={() => {
                  setRevenueSections((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  markDirty()
                }} type="button">删除</button>
              </div>
              <div className="cooperation-revenue-fields">
                <label className="editor-field">图标<input maxLength={20} placeholder="例如：💼" required value={item.icon} onChange={(event) => updateRevenue(index, { icon: event.target.value })} /></label>
                <label className="editor-field">分类名称<input maxLength={80} required value={item.title} onChange={(event) => updateRevenue(index, { title: event.target.value })} /></label>
              </div>
              <label className="editor-field">分类说明<textarea maxLength={1000} required rows={3} value={item.description} onChange={(event) => updateRevenue(index, { description: event.target.value })} /></label>
            </div>
          ))}
        </div>
        <button className="secondary-button add-full-button" onClick={() => {
          setRevenueSections((current) => [...current, { title: '', description: '', icon: '✦', displayOrder: current.length }])
          markDirty()
        }} type="button">添加收益分类</button>

        <div className="editor-section-heading">
          <span>3</span>
          <div><h3>合作价值</h3><p>为每个合作价值分类填写详情，可选配一张图片。</p></div>
        </div>
        <div className="cooperation-editor-list">
          {valueSections.length === 0 && <p className="empty-inline">暂未添加合作价值，发布前至少需要一项。</p>}
          {valueSections.map((item, index) => (
            <div className="cooperation-editor-card" key={index}>
              <div className="cooperation-editor-toolbar">
                <strong>合作价值 {index + 1}</strong>
                <button className="icon-text-button" disabled={index === 0} onClick={() => moveValue(index, -1)} type="button">上移</button>
                <button className="icon-text-button" disabled={index === valueSections.length - 1} onClick={() => moveValue(index, 1)} type="button">下移</button>
                <button className="icon-text-button danger" onClick={() => {
                  setValueSections((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  markDirty()
                }} type="button">删除</button>
              </div>
              <label className="editor-field">价值分类名称<input maxLength={80} required value={item.title} onChange={(event) => updateValue(index, { title: event.target.value })} /></label>
              <label className="editor-field">详细说明<textarea maxLength={5000} required rows={5} value={item.description} onChange={(event) => updateValue(index, { description: event.target.value })} /></label>
              <MediaUploadField
                accept="image/jpeg,image/png,image/webp"
                label="合作价值图片（选填）"
                mediaId={item.imageMediaId}
                mediaType="IMAGE"
                onReady={(media) => updateValue(index, { imageMediaId: media.id })}
                purpose="COOPERATION_IMAGE"
              />
              <label className="editor-field">图片说明（选填）<input maxLength={255} value={item.imageAltText ?? ''} onChange={(event) => updateValue(index, { imageAltText: event.target.value })} /></label>
            </div>
          ))}
        </div>
        <button className="secondary-button add-full-button" onClick={() => {
          setValueSections((current) => [...current, { title: '', description: '', displayOrder: current.length }])
          markDirty()
        }} type="button">添加合作价值</button>

        {publicationProblems.length > 0 && (
          <div className="publication-checklist" role="status">
            <strong>发布前还需要：</strong>
            <span>{publicationProblems.join('、')}</span>
          </div>
        )}
        <div className="editor-actions">
          <button className="primary-button" disabled={busy || !dirty} type="submit">{busy ? '处理中…' : '保存草稿'}</button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">预览草稿</button>
          <button className="secondary-button publish-button" disabled={busy || dirty || !content?.draft || publicationProblems.length > 0} onClick={() => void publish()} type="button">发布</button>
          {content?.visibility === 'PUBLISHED' && <button className="secondary-button danger-button" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>}
        </div>
        {dirty && <p className="unsaved-indicator">修改尚未保存。预览和发布前请先保存草稿。</p>}
      </form>

      {preview && <CooperationPreview content={preview} onClose={() => setPreview(undefined)} />}
    </>
  )
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function CooperationPreview({ content, onClose }: {
  content: AdminCooperationRevision
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <article aria-modal="true" className="modal-card content-preview" role="dialog">
        <div className="modal-header">
          <div><p className="eyebrow">合作权益草稿预览</p><h2>{content.title}</h2></div>
          <button aria-label="关闭预览" className="icon-button" onClick={onClose} type="button">×</button>
        </div>
        <p className="preview-summary">{content.summary}</p>
        <h3>核心收益来源</h3>
        <div className="cooperation-preview-grid">
          {content.revenueSections.map((item, index) => <div key={index}><span>{item.icon}</span><strong>{item.title}</strong><p>{item.description}</p></div>)}
        </div>
        <h3>合作价值</h3>
        {content.valueSections.map((item, index) => (
          <div className="cooperation-preview-value" key={index}>
            {item.imageMediaId && <MediaPreview alt={item.imageAltText} mediaId={item.imageMediaId} />}
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </div>
        ))}
      </article>
    </div>
  )
}
