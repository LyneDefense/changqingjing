import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AdminApiError,
  createAdminScenic,
  getAdminScenic,
  previewAdminScenic,
  publishAdminScenic,
  saveAdminScenicDraft,
  unpublishAdminScenic,
} from '../api/admin'
import type {
  AdminScenicContent,
  AdminScenicRevision,
  MapSelection,
  ScenicContentBlock,
  ScenicLocation,
  ScenicOpenStatus,
} from '../api/admin'
import { AdminIcon } from './AdminIcon'
import { MapLocationPicker } from './MapLocationPicker'
import { MediaPreview } from './MediaPreview'
import { MediaUploadField } from './MediaUploadField'
import { PageIntro } from './PageIntro'

interface ScenicEditorProps {
  scenicId?: string
  onChanged: () => void
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message + (error.traceId ? `（追踪号：${error.traceId}）` : '')
  }
  return '景区内容操作失败，请稍后重试'
}

const blankBlock: ScenicContentBlock = { type: 'PARAGRAPH', text: '' }
type ScenicEditorPanel = 'BASIC' | 'DETAIL' | 'LOCATION'

export function ScenicEditor({
  scenicId,
  onChanged,
  onClose,
  onDirtyChange,
}: ScenicEditorProps) {
  const [content, setContent] = useState<AdminScenicContent>()
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [coverMediaId, setCoverMediaId] = useState('')
  const [blocks, setBlocks] = useState<ScenicContentBlock[]>([{ ...blankBlock }])
  const [openStatus, setOpenStatus] = useState<ScenicOpenStatus>('OPEN')
  const [displayOrder, setDisplayOrder] = useState(0)
  const [location, setLocation] = useState<ScenicLocation>()
  const [displayName, setDisplayName] = useState('')
  const [locationSelectionId, setLocationSelectionId] = useState('')
  const [preview, setPreview] = useState<AdminScenicRevision>()
  const [activePanel, setActivePanel] = useState<ScenicEditorPanel>('BASIC')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(Boolean(scenicId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const markDirty = useCallback(() => {
    setDirty(true)
    onDirtyChange(true)
  }, [onDirtyChange])

  const hydrate = useCallback((next: AdminScenicContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setTitle(editable?.title ?? '')
    setSummary(editable?.summary ?? '')
    setCoverMediaId(editable?.coverMediaId ?? '')
    setBlocks(editable?.blocks.length ? editable.blocks : [{ ...blankBlock }])
    setOpenStatus(editable?.openStatus ?? 'OPEN')
    setDisplayOrder(editable?.displayOrder ?? 0)
    setLocation(editable?.location)
    setDisplayName(editable?.location?.displayName ?? '')
    setLocationSelectionId('')
    setDirty(false)
    onDirtyChange(false)
  }, [onDirtyChange])

  useEffect(() => {
    let active = true
    if (!scenicId) return () => { active = false }
    // Loading existing content is the effect's synchronization target.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    void getAdminScenic(scenicId)
      .then((next) => {
        if (active) hydrate(next)
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorText(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [hydrate, scenicId])

  const locationConfirmed = useCallback((selection: MapSelection) => {
    const keepCustomName = Boolean(location?.nameCustomized && displayName.trim())
    const nextDisplayName = keepCustomName ? displayName : selection.providerName
    setLocationSelectionId(selection.id)
    setDisplayName(nextDisplayName)
    setLocation({
      providerName: selection.providerName,
      providerAddress: selection.providerAddress,
      displayName: nextDisplayName,
      nameCustomized: nextDisplayName !== selection.providerName,
      longitude: selection.longitude,
      latitude: selection.latitude,
      coordinateSystem: selection.coordinateSystem,
    })
    markDirty()
  }, [displayName, location?.nameCustomized, markDirty])

  function updateBlock(index: number, patch: Partial<ScenicContentBlock>) {
    setBlocks((current) => current.map(
      (block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block,
    ))
    markDirty()
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    setBlocks((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    markDirty()
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !summary.trim()) {
      setActivePanel('BASIC')
      setError('请先填写景区名称和简短介绍。')
      return
    }
    if (blocks.some((block) => block.type === 'IMAGE' ? !block.mediaId : !block.text?.trim())) {
      setActivePanel('DETAIL')
      setError('请补充未填写完整的详情内容。')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    const input = {
      title,
      summary,
      coverMediaId: coverMediaId || undefined,
      blocks,
      openStatus,
      displayOrder,
      displayName: displayName || undefined,
      locationSelectionId: locationSelectionId || undefined,
      expectedVersion: content?.version ?? 0,
    }
    try {
      const currentScenicId = content?.id ?? scenicId
      const saved = currentScenicId
        ? await saveAdminScenicDraft(currentScenicId, input)
        : await createAdminScenic(input)
      hydrate(saved)
      setNotice('草稿已保存，不会立即影响小程序。')
      onChanged()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function showPreview() {
    if (!content?.id) return
    setBusy(true)
    setError('')
    try {
      setPreview(await previewAdminScenic(content.id))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!content?.draft || dirty) return
    if (!window.confirm('发布后，这条景区介绍会立即出现在小程序首页和景区列表。确认发布吗？')) return
    setBusy(true)
    setError('')
    try {
      hydrate(await publishAdminScenic(content.id, content.version))
      setNotice('景区介绍已发布。')
      onChanged()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (!content || !window.confirm('下架后，小程序将立即隐藏这条景区介绍。确认下架吗？')) return
    setBusy(true)
    setError('')
    try {
      hydrate(await unpublishAdminScenic(content.id, content.version))
      setNotice('景区介绍已下架。')
      onChanged()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  function closeEditor() {
    if (dirty && !window.confirm('景区内容还有修改没有保存，确定返回列表吗？')) return
    onDirtyChange(false)
    onClose()
  }

  if (loading) return <p className="empty-state">正在加载景区内容…</p>

  const currentScenicId = content?.id ?? scenicId

  return (
    <section className="scenic-editor-page">
      <div className="page-heading-row scenic-editor-heading">
        <div className="scenic-editor-heading__title">
          <button aria-label="返回景区列表" className="video-editor-back" onClick={closeEditor} type="button">←</button>
          <PageIntro
            title={currentScenicId ? '编辑景区' : '新增景区'}
            description="维护首页卡片、详情图文和可选导航位置。"
          />
          <span className={`status-pill ${content?.visibility === 'PUBLISHED' ? 'active' : 'disabled'}`}>
            {content?.visibility === 'PUBLISHED' ? '线上展示中' : content?.firstPublishedAt ? '已下架' : '草稿'}
          </span>
        </div>
        <div className="scenic-page-actions">
          <button className="secondary-button" disabled={busy || !dirty} form="scenic-content-form" type="submit">{busy ? '处理中…' : '保存草稿'}</button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">预览草稿</button>
          <button className="primary-button" disabled={busy || dirty || !content?.draft} onClick={() => void publish()} type="button">发布</button>
          {content?.visibility === 'PUBLISHED' && (
            <button className="text-button danger" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>
          )}
        </div>
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}

      <div className="scenic-editor-layout">
        <form className="scenic-compact-editor" id="scenic-content-form" onSubmit={save}>
          <div aria-label="景区编辑内容" className="company-editor-tabs" role="tablist">
            <button aria-selected={activePanel === 'BASIC'} className={activePanel === 'BASIC' ? 'active' : ''} onClick={() => setActivePanel('BASIC')} role="tab" type="button">基础信息</button>
            <button aria-selected={activePanel === 'DETAIL'} className={activePanel === 'DETAIL' ? 'active' : ''} onClick={() => setActivePanel('DETAIL')} role="tab" type="button">详情内容 <span>{blocks.length}</span></button>
            <button aria-selected={activePanel === 'LOCATION'} className={activePanel === 'LOCATION' ? 'active' : ''} onClick={() => setActivePanel('LOCATION')} role="tab" type="button">导航位置 <span>{location ? '已配置' : '选填'}</span></button>
          </div>

          <div className="company-version-strip">
            <span><small>线上版本</small><strong>{content?.published ? `第 ${content.published.revisionNumber} 版` : '暂无'}</strong></span>
            <i />
            <span><small>当前草稿</small><strong>{content?.draft ? `第 ${content.draft.revisionNumber} 版` : '尚未保存'}</strong></span>
            <i />
            <span><small>开放状态</small><strong>{openStatus === 'OPEN' ? '正常开放' : '暂停开放'}</strong></span>
          </div>

          {activePanel === 'BASIC' && (
            <section className="scenic-editor-panel">
              <div className="compact-editor-heading">
                <span><AdminIcon name="scenic" /></span>
                <div><h3>首页卡片与基本信息</h3><p>名称、简介和封面同时用于景区列表及详情页。</p></div>
              </div>
              <div className="scenic-basic-fields">
                <label className="editor-field scenic-title-field">
                  <span>景区名称</span>
                  <input aria-label="景区名称" maxLength={255} onChange={(event) => { setTitle(event.target.value); markDirty() }} placeholder="输入景区名称" required value={title} />
                </label>
                <label className="editor-field scenic-summary-field">
                  <span>简短介绍</span>
                  <textarea aria-label="简短介绍" maxLength={2000} onChange={(event) => { setSummary(event.target.value); markDirty() }} placeholder="用于首页卡片的简短说明" required rows={3} value={summary} />
                </label>
                <div className="scenic-cover-field">
                  <MediaUploadField
                    accept="image/jpeg,image/png,image/webp"
                    label="景区列表封面"
                    mediaId={coverMediaId || undefined}
                    mediaType="IMAGE"
                    onReady={(media) => { setCoverMediaId(media.id); markDirty() }}
                    purpose="SCENIC_IMAGE"
                  />
                </div>
                <div className="two-column-fields scenic-state-fields">
                  <label className="editor-field">
                    景区开放状态
                    <select value={openStatus} onChange={(event) => { setOpenStatus(event.target.value as ScenicOpenStatus); markDirty() }}>
                      <option value="OPEN">正常开放</option>
                      <option value="PAUSED">暂停开放</option>
                    </select>
                    <small className="field-help">暂停开放仍展示内容，不等同于下架。</small>
                  </label>
                  <label className="editor-field">
                    首页展示顺序
                    <input max={10000} min={0} onChange={(event) => { setDisplayOrder(Number(event.target.value)); markDirty() }} type="number" value={displayOrder} />
                    <small className="field-help">数字越小越靠前。</small>
                  </label>
                </div>
              </div>
            </section>
          )}

          {activePanel === 'DETAIL' && (
            <section className="scenic-editor-panel">
              <div className="scenic-panel-heading">
                <div className="compact-editor-heading">
                  <span><AdminIcon name="company" /></span>
                  <div><h3>详情图文</h3><p>小标题、正文和图片将按当前顺序展示。</p></div>
                </div>
                <div className="section-add-actions">
                  <button className="secondary-button" onClick={() => { setBlocks((current) => [...current, { ...blankBlock }]); markDirty() }} type="button">＋ 添加文字</button>
                  <button className="secondary-button" onClick={() => { setBlocks((current) => [...current, { type: 'IMAGE', altText: '' }]); markDirty() }} type="button">＋ 添加图片</button>
                </div>
              </div>
              <div className="content-blocks scenic-content-blocks">
                {blocks.map((block, index) => (
                  <div className="content-block scenic-content-block" key={index}>
                    <div className="block-toolbar">
                      <select aria-label={`第 ${index + 1} 项内容类型`} value={block.type} onChange={(event) => updateBlock(index, {
                        type: event.target.value as ScenicContentBlock['type'],
                        text: event.target.value === 'IMAGE' ? undefined : block.text ?? '',
                        mediaId: event.target.value === 'IMAGE' ? block.mediaId : undefined,
                      })}>
                        <option value="HEADING">小标题</option>
                        <option value="PARAGRAPH">正文</option>
                        <option value="IMAGE">图片</option>
                      </select>
                      <span>内容 {String(index + 1).padStart(2, '0')}</span>
                      <button className="icon-text-button" disabled={index === 0} onClick={() => moveBlock(index, -1)} type="button">上移</button>
                      <button className="icon-text-button" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} type="button">下移</button>
                      <button className="icon-text-button danger" disabled={blocks.length === 1} onClick={() => { setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index)); markDirty() }} type="button">删除</button>
                    </div>
                    {block.type === 'IMAGE' ? (
                      <div className="scenic-block-image-fields">
                        <MediaUploadField
                          accept="image/jpeg,image/png,image/webp"
                          label={`详情图片 ${index + 1}`}
                          mediaId={block.mediaId}
                          mediaType="IMAGE"
                          onReady={(media) => updateBlock(index, { mediaId: media.id })}
                          purpose="SCENIC_IMAGE"
                        />
                        <input aria-label={`第 ${index + 1} 张图片说明`} maxLength={255} onChange={(event) => updateBlock(index, { altText: event.target.value })} placeholder="图片说明（选填）" value={block.altText ?? ''} />
                      </div>
                    ) : (
                      <textarea aria-label={`第 ${index + 1} 项文字内容`} maxLength={10000} onChange={(event) => updateBlock(index, { text: event.target.value })} placeholder={block.type === 'HEADING' ? '输入小标题' : '输入正文内容'} required rows={block.type === 'HEADING' ? 2 : 4} value={block.text ?? ''} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activePanel === 'LOCATION' && (
            <section className="scenic-editor-panel">
              <div className="compact-editor-heading">
                <span><AdminIcon name="scenic" /></span>
                <div><h3>导航位置</h3><p>按需配置；不选择地图位置也能正常保存和发布。</p></div>
              </div>
              <MapLocationPicker location={location} onConfirmed={locationConfirmed} />
              {location && (
                <label className="editor-field scenic-location-name">
                  小程序展示名称
                  <input maxLength={255} onChange={(event) => {
                    const nextName = event.target.value
                    setDisplayName(nextName)
                    setLocation({ ...location, displayName: nextName, nameCustomized: nextName.trim() !== location.providerName })
                    markDirty()
                  }} placeholder="默认使用地图地点名称" value={displayName} />
                  <small className="field-help">只修改展示名称，不会改变地图坐标。</small>
                </label>
              )}
            </section>
          )}

          <div className="hero-draft-note">
            <span aria-hidden="true">i</span>
            {dirty ? '修改尚未保存。预览和发布前请先保存草稿。' : '草稿不会影响小程序，发布后才会更新线上景区内容。'}
          </div>
        </form>

        <aside className="scenic-mini-preview">
          <div className="hero-mini-preview__heading">
            <div><span aria-hidden="true">▯</span><strong>小程序预览</strong></div>
            <small>景区详情实时预览</small>
          </div>
          <div className="hero-phone-preview scenic-phone-preview">
            <div className="hero-phone-preview__status"><strong>9:41</strong><span>● ◒ ▰</span></div>
            <div className="hero-phone-preview__nav"><strong>景区详情</strong><span>•••　◉</span></div>
            <div className="scenic-phone-preview__content">
              <div className={`scenic-phone-preview__cover${coverMediaId ? ' has-image' : ''}`}>
                {coverMediaId ? <MediaPreview alt={title || '景区封面'} mediaId={coverMediaId} /> : <span>上传封面后在此预览</span>}
              </div>
              <div className="scenic-phone-preview__intro">
                <div><strong>{title || '景区名称'}</strong><small>{openStatus === 'OPEN' ? '正常开放' : '暂停开放'}</small></div>
                <p>{summary || '填写简短介绍后在此预览。'}</p>
              </div>
              <div className="scenic-phone-preview__blocks">
                {blocks.slice(0, 4).map((block, index) => {
                  if (block.type === 'HEADING') return <strong key={index}>{block.text || '详情小标题'}</strong>
                  if (block.type === 'IMAGE') return block.mediaId ? <MediaPreview alt={block.altText || '景区详情图片'} key={index} mediaId={block.mediaId} /> : <span className="scenic-phone-preview__image-placeholder" key={index}>详情图片</span>
                  return <p key={index}>{block.text || '景区正文内容将在这里展示。'}</p>
                })}
              </div>
              {location && <div className="scenic-phone-preview__location"><span>导航位置</span><strong>{displayName || location.providerName}</strong></div>}
            </div>
          </div>
        </aside>
      </div>

      {preview && (
        <div className="modal-backdrop" role="presentation">
          <article aria-modal="true" className="modal-card content-preview" role="dialog">
            <div className="modal-header">
              <div><p className="eyebrow">景区草稿预览</p><h2>{preview.title}</h2></div>
              <button aria-label="关闭预览" className="icon-button" onClick={() => setPreview(undefined)} type="button">×</button>
            </div>
            <MediaPreview alt={preview.title} mediaId={preview.coverMediaId} />
            <p className="preview-summary">{preview.summary}</p>
            <p><strong>{preview.openStatus === 'OPEN' ? '正常开放' : '暂停开放'}</strong></p>
            {preview.blocks.map((block, index) => {
              if (block.type === 'HEADING') return <h3 key={index}>{block.text}</h3>
              if (block.type === 'IMAGE') return <MediaPreview alt={block.altText} key={index} mediaId={block.mediaId} />
              return <p key={index}>{block.text}</p>
            })}
            {preview.location && (
              <div className="selected-location-card">
                <strong>{preview.location.displayName}</strong>
                <span>{preview.location.providerAddress}</span>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  )
}
