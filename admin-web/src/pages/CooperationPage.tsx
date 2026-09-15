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
import { AdminIcon } from '../components/AdminIcon'
import { CooperationIcon } from '../components/CooperationIcon'
import { cooperationIconOptions, resolveCooperationIcon } from '../components/cooperationIconConfig'
import { PageIntro } from '../components/PageIntro'
import { MobilePreview } from '../components/MobilePreview'

const fixedPageTitle = '常清静文旅投'
const fixedPageSummary = '业务架构与合作权利'

const initialRevenueSections: CooperationRevenueSection[] = [
  ['招商收益', 'cooperate'],
  ['招募收益', 'people'],
  ['基础业务', 'lodging'],
  ['供应链', 'product'],
  ['衍生业务', 'nature'],
  ['特色服务', 'service'],
  ['增项板块', 'blessing'],
].map(([title, icon], index) => ({ title, icon, description: '', displayOrder: index }))

type CooperationEditorPanel = 'REVENUE' | 'VALUE'
type CooperationPreviewMode = 'REVENUE' | 'COMING_SOON'

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message + (error.traceId ? `（追踪号：${error.traceId}）` : '')
  }
  return '合作权益操作失败，请稍后重试'
}

export function CooperationPage() {
  const [content, setContent] = useState<AdminCooperationContent>()
  const [revenueSections, setRevenueSections] = useState(initialRevenueSections)
  const [valueSections, setValueSections] = useState<CooperationValueSection[]>([])
  const [preview, setPreview] = useState<AdminCooperationRevision>()
  const [activePanel, setActivePanel] = useState<CooperationEditorPanel>('REVENUE')
  const [previewMode, setPreviewMode] = useState<CooperationPreviewMode>('REVENUE')
  const [expandedRevenueIndexes, setExpandedRevenueIndexes] = useState<Set<number>>(new Set([0]))
  const [expandedValueIndexes, setExpandedValueIndexes] = useState<Set<number>>(new Set())
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const blocker = useBlocker(dirty)

  const markDirty = useCallback(() => {
    setDirty(true)
    setNotice('')
  }, [])

  const hydrate = useCallback((next: AdminCooperationContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setRevenueSections(editable?.revenueSections.length
      ? editable.revenueSections.map((item) => ({
          ...item,
          icon: resolveCooperationIcon(item.icon, item.title),
        }))
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
    if (revenueSections.length === 0) problems.push('添加核心收益分类')
    if (revenueSections.some((item) => !item.title.trim() || !item.description.trim() || !item.icon.trim())) {
      problems.push('补全收益分类的名称、说明和图标')
    }
    if (valueSections.length === 0) problems.push('添加合作价值分类')
    if (valueSections.some((item) => !item.title.trim() || !item.description.trim())) {
      problems.push('补全合作价值的分类名称和详情')
    }
    return problems
  }, [revenueSections, valueSections])

  function updateRevenue(index: number, patch: Partial<CooperationRevenueSection>) {
    setRevenueSections((current) => current.map(
      (item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item,
    ))
    markDirty()
  }

  function updateRevenueTitle(index: number, title: string) {
    setRevenueSections((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const previousSuggestedIcon = resolveCooperationIcon(undefined, item.title)
      const nextSuggestedIcon = resolveCooperationIcon(undefined, title)
      const followsSuggestion = item.icon === previousSuggestedIcon || item.icon === 'general'
      return { ...item, title, icon: followsSuggestion ? nextSuggestedIcon : item.icon }
    }))
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

  function toggleIndex(index: number, setter: (value: Set<number>) => void, current: Set<number>) {
    const next = new Set(current)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setter(next)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (revenueSections.some((item) => !item.title.trim() || !item.description.trim())) {
      setActivePanel('REVENUE')
      setError('请先补全所有收益分类的名称和说明。')
      return
    }
    if (valueSections.some((item) => !item.title.trim() || !item.description.trim())) {
      setActivePanel('VALUE')
      setError('请先补全所有合作价值的名称和说明。')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await saveAdminCooperationDraft({
        title: fixedPageTitle,
        summary: fixedPageSummary,
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
    <section className="cooperation-admin-page">
      <div className="page-heading-row cooperation-page-heading">
        <div className="cooperation-page-heading__title">
          <PageIntro title="收益板块管理" description="维护合作权益中的核心收益来源和合作价值总结。" />
          <span className={`status-pill ${content?.visibility === 'PUBLISHED' ? 'active' : 'disabled'}`}>
            {content?.visibility === 'PUBLISHED' ? '线上展示中' : content?.firstPublishedAt ? '已下架' : '草稿'}
          </span>
          {content?.draft && content.published?.id !== content.draft.id && <span className="company-draft-badge">有未发布修改</span>}
        </div>
        <div className="cooperation-page-actions">
          <button className="secondary-button" disabled={busy || !dirty} form="cooperation-content-form" type="submit">{busy ? '处理中…' : '保存草稿'}</button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">预览草稿</button>
          <button className="primary-button" disabled={busy || dirty || !content?.draft || publicationProblems.length > 0} onClick={() => void publish()} type="button">发布</button>
          {content?.visibility === 'PUBLISHED' && <button className="text-button danger" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>}
        </div>
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}

      <div className="cooperation-editor-layout">
        <form className="cooperation-compact-editor" id="cooperation-content-form" onSubmit={(event) => void save(event)}>
          <div aria-label="收益板块编辑内容" className="company-editor-tabs" role="tablist">
            <button aria-selected={activePanel === 'REVENUE'} className={activePanel === 'REVENUE' ? 'active' : ''} onClick={() => setActivePanel('REVENUE')} role="tab" type="button">核心收益来源 <span>{revenueSections.length}</span></button>
            <button aria-selected={activePanel === 'VALUE'} className={activePanel === 'VALUE' ? 'active' : ''} onClick={() => setActivePanel('VALUE')} role="tab" type="button">合作价值总结 <span>{valueSections.length}</span></button>
          </div>

          <div className="company-version-strip">
            <span><small>线上版本</small><strong>{content?.published ? `第 ${content.published.revisionNumber} 版` : '暂无'}</strong></span>
            <i />
            <span><small>当前草稿</small><strong>{content?.draft ? `第 ${content.draft.revisionNumber} 版` : '尚未保存'}</strong></span>
            <i />
            <span><small>发布条件</small><strong>{publicationProblems.length === 0 ? '已满足' : `还差 ${publicationProblems.length} 项`}</strong></span>
          </div>

          {activePanel === 'REVENUE' && (
            <section className="cooperation-editor-panel">
              <div className="cooperation-panel-heading">
                <div className="compact-editor-heading">
                  <span><AdminIcon name="cooperation" /></span>
                  <div><h3>核心收益来源</h3><p>系统会根据分类名称匹配图标，也可手动调整。</p></div>
                </div>
                <div className="cooperation-panel-actions">
                  <button className="icon-text-button" disabled={expandedRevenueIndexes.size === revenueSections.length} onClick={() => setExpandedRevenueIndexes(new Set(revenueSections.map((_, index) => index)))} type="button">全部展开</button>
                  <button className="icon-text-button" disabled={expandedRevenueIndexes.size === 0} onClick={() => setExpandedRevenueIndexes(new Set())} type="button">全部收起</button>
                </div>
              </div>
              <div className="cooperation-compact-list">
                {revenueSections.length === 0 && <p className="product-detail-empty">暂未添加收益分类，发布前至少需要一项。</p>}
                {revenueSections.map((item, index) => {
                  const expanded = expandedRevenueIndexes.has(index)
                  return (
                    <article className={`cooperation-compact-card${expanded ? ' expanded' : ''}`} key={index}>
                      <div className="cooperation-compact-card__toolbar">
                        <button aria-expanded={expanded} aria-label={`${expanded ? '收起' : '展开'}收益分类 ${index + 1}`} className="cooperation-compact-card__toggle" onClick={() => toggleIndex(index, setExpandedRevenueIndexes, expandedRevenueIndexes)} type="button">
                          <span className="cooperation-compact-card__icon"><CooperationIcon icon={item.icon} title={item.title} /></span>
                          <small>收益 {String(index + 1).padStart(2, '0')}</small>
                          <strong>{item.title || '未填写分类名称'}</strong>
                          <em>{item.description || '展开后填写分类说明'}</em>
                          <i>⌄</i>
                        </button>
                        <div className="cooperation-compact-card__actions">
                          <button className="icon-text-button" disabled={index === 0} onClick={() => moveRevenue(index, -1)} type="button">上移</button>
                          <button className="icon-text-button" disabled={index === revenueSections.length - 1} onClick={() => moveRevenue(index, 1)} type="button">下移</button>
                          <button className="icon-text-button danger" onClick={() => {
                            setRevenueSections((current) => current.filter((_, itemIndex) => itemIndex !== index))
                            markDirty()
                          }} type="button">删除</button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="cooperation-compact-card__fields">
                          <label className="editor-field">分类名称<input maxLength={80} required value={item.title} onChange={(event) => updateRevenueTitle(index, event.target.value)} /></label>
                          <label className="editor-field">展示图标
                            <select aria-label={`收益分类 ${index + 1} 图标`} value={item.icon} onChange={(event) => updateRevenue(index, { icon: event.target.value })}>
                              {cooperationIconOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                            </select>
                            <small className="field-help">新增分类默认自动匹配，可在这里调整。</small>
                          </label>
                          <label className="editor-field cooperation-description-field">分类说明<textarea maxLength={1000} required rows={3} value={item.description} onChange={(event) => updateRevenue(index, { description: event.target.value })} /></label>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
              <button className="secondary-button add-full-button" onClick={() => {
                const newIndex = revenueSections.length
                setRevenueSections((current) => [...current, { title: '', description: '', icon: 'general', displayOrder: current.length }])
                setExpandedRevenueIndexes((current) => new Set(current).add(newIndex))
                markDirty()
              }} type="button">＋ 添加收益分类</button>
            </section>
          )}

          {activePanel === 'VALUE' && (
            <section className="cooperation-editor-panel">
              <div className="cooperation-panel-heading">
                <div className="compact-editor-heading">
                  <span><AdminIcon name="cooperation" /></span>
                  <div><h3>合作价值总结</h3><p>小程序仅展示分类名称和说明，图标按顺序自动生成。</p></div>
                </div>
                <div className="cooperation-panel-actions">
                  <button className="icon-text-button" disabled={expandedValueIndexes.size === valueSections.length} onClick={() => setExpandedValueIndexes(new Set(valueSections.map((_, index) => index)))} type="button">全部展开</button>
                  <button className="icon-text-button" disabled={expandedValueIndexes.size === 0} onClick={() => setExpandedValueIndexes(new Set())} type="button">全部收起</button>
                </div>
              </div>
              <div className="cooperation-compact-list">
                {valueSections.length === 0 && <p className="product-detail-empty">暂未添加合作价值，发布前至少需要一项。</p>}
                {valueSections.map((item, index) => {
                  const expanded = expandedValueIndexes.has(index)
                  return (
                    <article className={`cooperation-compact-card cooperation-value-editor-card${expanded ? ' expanded' : ''}`} key={index}>
                      <div className="cooperation-compact-card__toolbar">
                        <button aria-expanded={expanded} aria-label={`${expanded ? '收起' : '展开'}合作价值 ${index + 1}`} className="cooperation-compact-card__toggle" onClick={() => toggleIndex(index, setExpandedValueIndexes, expandedValueIndexes)} type="button">
                          <span className={`cooperation-value-preview-icon kind-${index % 3}`} />
                          <small>价值 {String(index + 1).padStart(2, '0')}</small>
                          <strong>{item.title || '未填写分类名称'}</strong>
                          <em>{item.description || '展开后填写详细说明'}</em>
                          <i>⌄</i>
                        </button>
                        <div className="cooperation-compact-card__actions">
                          <button className="icon-text-button" disabled={index === 0} onClick={() => moveValue(index, -1)} type="button">上移</button>
                          <button className="icon-text-button" disabled={index === valueSections.length - 1} onClick={() => moveValue(index, 1)} type="button">下移</button>
                          <button className="icon-text-button danger" onClick={() => {
                            setValueSections((current) => current.filter((_, itemIndex) => itemIndex !== index))
                            markDirty()
                          }} type="button">删除</button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="cooperation-compact-card__fields cooperation-value-fields">
                          <label className="editor-field">价值分类名称<input maxLength={80} required value={item.title} onChange={(event) => updateValue(index, { title: event.target.value })} /></label>
                          <label className="editor-field">详细说明<textarea maxLength={5000} required rows={3} value={item.description} onChange={(event) => updateValue(index, { description: event.target.value })} /></label>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
              <button className="secondary-button add-full-button" onClick={() => {
                const newIndex = valueSections.length
                setValueSections((current) => [...current, { title: '', description: '', displayOrder: current.length }])
                setExpandedValueIndexes((current) => new Set(current).add(newIndex))
                markDirty()
              }} type="button">＋ 添加合作价值</button>
            </section>
          )}

          {publicationProblems.length > 0 && (
            <div className="publication-checklist compact-publication-checklist" role="status"><strong>发布前还需要：</strong><span>{publicationProblems.join('、')}</span></div>
          )}
          <div className="hero-draft-note">
            <span aria-hidden="true">i</span>
            {dirty ? '修改尚未保存。预览和发布前请先保存草稿。' : '草稿不会影响小程序，发布后才会更新线上合作权益。'}
          </div>
        </form>

        <MobilePreview><aside className="cooperation-mini-preview">
          <div className="company-preview-heading">
            <div><span aria-hidden="true">▯</span><strong>小程序预览</strong></div>
            <div className="company-preview-switch" role="group" aria-label="合作权益预览状态">
              <button className={previewMode === 'REVENUE' ? 'active' : ''} onClick={() => setPreviewMode('REVENUE')} type="button">收益板块</button>
              <button className={previewMode === 'COMING_SOON' ? 'active' : ''} onClick={() => setPreviewMode('COMING_SOON')} type="button">敬请期待</button>
            </div>
          </div>
          <div className="hero-phone-preview cooperation-phone-preview">
            <div className="hero-phone-preview__status"><strong>9:41</strong><span>● ◒ ▰</span></div>
            <div className="hero-phone-preview__nav"><strong>合作权益</strong><span>•••　◉</span></div>
            <div className="cooperation-phone-preview__content">
              <div className="cooperation-phone-preview__hero">
                <strong>{fixedPageTitle}</strong><span>净</span><p>{fixedPageSummary}</p>
              </div>
              <div className="cooperation-phone-preview__tabs">
                <span className={previewMode === 'REVENUE' ? 'active' : ''}>收益板块</span><span className={previewMode === 'COMING_SOON' ? 'active' : ''}>分公司方案</span><span>会员体系</span>
              </div>
              {previewMode === 'REVENUE' ? (
                <section className="cooperation-phone-preview__revenue">
                  <div><strong>核心收益来源</strong><small>{revenueSections.length} 大板块</small></div>
                  <div className="cooperation-phone-preview__revenue-grid">
                    {revenueSections.slice(0, 7).map((item, index) => (
                      <article key={index}><CooperationIcon icon={item.icon} title={item.title} /><div><strong>{item.title || '收益分类'}</strong><p>{item.description || '分类说明'}</p></div></article>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="cooperation-phone-preview__soon"><span>净</span><strong>敬请期待</strong><p>更多合作方案正在准备中</p></div>
              )}
              <section className="cooperation-phone-preview__values">
                <strong>合作价值总结</strong>
                <div>
                  {valueSections.slice(0, 3).map((item, index) => (
                    <article key={index}><span className={`cooperation-value-preview-icon kind-${index % 3}`} /><strong>{item.title || '价值分类'}</strong><p>{item.description || '价值说明'}</p></article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </aside></MobilePreview>
      </div>

      {preview && <CooperationPreview content={preview} onClose={() => setPreview(undefined)} />}
    </section>
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
          <div><p className="eyebrow">合作权益草稿预览</p><h2>{fixedPageTitle}</h2></div>
          <button aria-label="关闭预览" className="icon-button" onClick={onClose} type="button">×</button>
        </div>
        <p className="preview-summary">{fixedPageSummary}</p>
        <h3>核心收益来源</h3>
        <div className="cooperation-preview-grid">
          {content.revenueSections.map((item, index) => (
            <div key={index}>
              <CooperationIcon icon={item.icon} title={item.title} />
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
        <h3>合作价值总结</h3>
        {content.valueSections.map((item, index) => (
          <div className="cooperation-preview-value" key={index}>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </div>
        ))}
      </article>
    </div>
  )
}
