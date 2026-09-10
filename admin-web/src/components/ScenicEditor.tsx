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
import { MapLocationPicker } from './MapLocationPicker'
import { MediaPreview } from './MediaPreview'
import { MediaUploadField } from './MediaUploadField'

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
      const saved = scenicId
        ? await saveAdminScenicDraft(scenicId, input)
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

  if (loading) return <p className="empty-state">正在加载景区内容…</p>

  return (
    <>
      <div className="editor-title-row">
        <div>
          <h3>{scenicId ? '编辑景区介绍' : '新增景区介绍'}</h3>
          <p>先保存草稿并预览，确认无误后再发布到小程序。</p>
        </div>
        <button className="secondary-button" onClick={onClose} type="button">返回景区列表</button>
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}

      <form className="content-editor" onSubmit={save}>
        <div className="editor-section-heading">
          <span>1</span>
          <div><h3>基本信息</h3><p>用于小程序景区卡片和详情页顶部。</p></div>
        </div>
        <label className="editor-field">
          景区名称
          <input required maxLength={255} value={title} onChange={(event) => {
            setTitle(event.target.value)
            markDirty()
          }} />
        </label>
        <label className="editor-field">
          简短介绍
          <textarea required maxLength={2000} rows={4} value={summary} onChange={(event) => {
            setSummary(event.target.value)
            markDirty()
          }} />
        </label>
        <MediaUploadField
          accept="image/jpeg,image/png,image/webp"
          label="景区列表封面"
          mediaId={coverMediaId || undefined}
          mediaType="IMAGE"
          onReady={(media) => {
            setCoverMediaId(media.id)
            markDirty()
          }}
          purpose="SCENIC_IMAGE"
        />
        <div className="two-column-fields">
          <label className="editor-field">
            景区开放状态
            <select value={openStatus} onChange={(event) => {
              setOpenStatus(event.target.value as ScenicOpenStatus)
              markDirty()
            }}>
              <option value="OPEN">正常开放</option>
              <option value="PAUSED">暂停开放</option>
            </select>
            <small className="field-help">暂停开放仍会展示介绍和导航位置，不等同于下架。</small>
          </label>
          <label className="editor-field">
            首页展示顺序
            <input min={0} max={10000} type="number" value={displayOrder} onChange={(event) => {
              setDisplayOrder(Number(event.target.value))
              markDirty()
            }} />
            <small className="field-help">数字越小越靠前。</small>
          </label>
        </div>

        <div className="editor-section-heading">
          <span>2</span>
          <div><h3>详细介绍</h3><p>按顺序添加小标题、正文和图片。</p></div>
        </div>
        <div className="content-blocks">
          {blocks.map((block, index) => (
            <div className="content-block" key={index}>
              <div className="block-toolbar">
                <select value={block.type} onChange={(event) => updateBlock(index, {
                  type: event.target.value as ScenicContentBlock['type'],
                  text: event.target.value === 'IMAGE' ? undefined : block.text ?? '',
                  mediaId: event.target.value === 'IMAGE' ? block.mediaId : undefined,
                })}>
                  <option value="HEADING">小标题</option>
                  <option value="PARAGRAPH">正文</option>
                  <option value="IMAGE">图片</option>
                </select>
                <span>内容 {index + 1}</span>
                <button className="icon-text-button" disabled={index === 0} onClick={() => moveBlock(index, -1)} type="button">上移</button>
                <button className="icon-text-button" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} type="button">下移</button>
                <button className="icon-text-button danger" disabled={blocks.length === 1} onClick={() => {
                  setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index))
                  markDirty()
                }} type="button">删除</button>
              </div>
              {block.type === 'IMAGE' ? (
                <>
                  <MediaUploadField
                    accept="image/jpeg,image/png,image/webp"
                    label={`详情图片 ${index + 1}`}
                    mediaId={block.mediaId}
                    mediaType="IMAGE"
                    onReady={(media) => updateBlock(index, { mediaId: media.id })}
                    purpose="SCENIC_IMAGE"
                  />
                  <input maxLength={255} placeholder="图片说明（选填）" value={block.altText ?? ''} onChange={(event) => updateBlock(index, { altText: event.target.value })} />
                </>
              ) : (
                <textarea required maxLength={10000} rows={block.type === 'HEADING' ? 2 : 6} value={block.text ?? ''} onChange={(event) => updateBlock(index, { text: event.target.value })} />
              )}
            </div>
          ))}
        </div>
        <div className="section-add-actions">
          <button className="secondary-button" onClick={() => {
            setBlocks((current) => [...current, { ...blankBlock }])
            markDirty()
          }} type="button">添加文字</button>
          <button className="secondary-button" onClick={() => {
            setBlocks((current) => [...current, { type: 'IMAGE', altText: '' }])
            markDirty()
          }} type="button">添加图片</button>
        </div>

        <div className="editor-section-heading">
          <span>3</span>
          <div><h3>导航位置（选填）</h3><p>需要让游客导航时再配置；不配置不影响景区发布。</p></div>
        </div>
        <MapLocationPicker location={location} onConfirmed={locationConfirmed} />
        {location && (
          <label className="editor-field">
            小程序展示名称
            <input maxLength={255} placeholder="默认使用地图地点名称" value={displayName} onChange={(event) => {
              const nextName = event.target.value
              setDisplayName(nextName)
              setLocation({
                ...location,
                displayName: nextName,
                nameCustomized: nextName.trim() !== location.providerName,
              })
              markDirty()
            }} />
            <small className="field-help">这里只改变小程序显示的名称，不会重新搜索或修改坐标。</small>
          </label>
        )}

        <div className="editor-actions">
          <button className="primary-button" disabled={busy || !dirty} type="submit">{busy ? '处理中…' : '保存草稿'}</button>
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
    </>
  )
}
