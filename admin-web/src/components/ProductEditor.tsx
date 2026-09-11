import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AdminApiError,
  createAdminProduct,
  getAdminProduct,
  previewAdminProduct,
  publishAdminProduct,
  saveAdminProductDraft,
  unpublishAdminProduct,
} from '../api/admin'
import type {
  AdminProductCategory,
  AdminProductContent,
  AdminProductRevision,
  ProductContentBlock,
} from '../api/admin'
import { MediaPreview } from './MediaPreview'
import { MediaUploadField } from './MediaUploadField'

interface ProductEditorProps {
  productId?: string
  categories: AdminProductCategory[]
  onChanged: () => void
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message + (error.traceId ? `（追踪号：${error.traceId}）` : '')
  }
  return '福利产品操作失败，请稍后重试'
}

function hasBlockContent(block: ProductContentBlock) {
  return block.type === 'IMAGE' ? Boolean(block.mediaId) : Boolean(block.text?.trim())
}

export function ProductEditor({
  productId,
  categories,
  onChanged,
  onClose,
  onDirtyChange,
}: ProductEditorProps) {
  const [content, setContent] = useState<AdminProductContent>()
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [coverMediaId, setCoverMediaId] = useState('')
  const [listImageMediaIds, setListImageMediaIds] = useState<string[]>([])
  const [listImageUploadKey, setListImageUploadKey] = useState(0)
  const [blocks, setBlocks] = useState<ProductContentBlock[]>([])
  const [specification, setSpecification] = useState('')
  const [displayOrder, setDisplayOrder] = useState(0)
  const [preview, setPreview] = useState<AdminProductRevision>()
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(Boolean(productId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const markDirty = useCallback(() => {
    setDirty(true)
    onDirtyChange(true)
  }, [onDirtyChange])

  const hydrate = useCallback((next: AdminProductContent) => {
    const editable = next.draft ?? next.published
    setContent(next)
    setName(editable?.name ?? '')
    setSummary(editable?.summary ?? '')
    setCategoryId(editable?.categoryId ?? '')
    setCoverMediaId(editable?.coverMediaId ?? '')
    setListImageMediaIds(editable?.listImageMediaIds?.length
      ? editable.listImageMediaIds
      : editable?.coverMediaId ? [editable.coverMediaId] : [])
    setBlocks(editable?.blocks ?? [])
    setSpecification(editable?.specification ?? '')
    setDisplayOrder(editable?.displayOrder ?? 0)
    setDirty(false)
    onDirtyChange(false)
  }, [onDirtyChange])

  useEffect(() => {
    let active = true
    if (!productId) return () => { active = false }
    // Loading existing content is the effect's synchronization target.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    void getAdminProduct(productId)
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
  }, [hydrate, productId])

  const publicationProblems = useMemo(() => {
    const problems: string[] = []
    if (!name.trim()) problems.push('填写产品名称')
    if (!summary.trim()) problems.push('填写简短介绍')
    if (!coverMediaId) problems.push('上传产品图片并选择列表封面')
    return problems
  }, [coverMediaId, name, summary])

  function updateBlock(index: number, patch: Partial<ProductContentBlock>) {
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
      name,
      summary,
      categoryId: categoryId || undefined,
      coverMediaId: coverMediaId || undefined,
      listImageMediaIds,
      blocks: blocks.filter(hasBlockContent),
      specification: specification || undefined,
      displayOrder,
      expectedVersion: content?.version ?? 0,
    }
    try {
      const currentId = productId ?? content?.id
      const saved = currentId
        ? await saveAdminProductDraft(currentId, input)
        : await createAdminProduct(input)
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
      setPreview(await previewAdminProduct(content.id))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!content?.draft || dirty || publicationProblems.length > 0) return
    if (!window.confirm('上架后，已登录会员会立即看到这个产品。确认上架吗？')) return
    setBusy(true)
    setError('')
    try {
      hydrate(await publishAdminProduct(content.id, content.version))
      setNotice('福利产品已上架。')
      onChanged()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    if (!content || !window.confirm('下架后，会员将立即无法查看这个产品。确认下架吗？')) return
    setBusy(true)
    setError('')
    try {
      hydrate(await unpublishAdminProduct(content.id, content.version))
      setNotice('福利产品已下架。')
      onChanged()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="empty-state">正在加载福利产品…</p>

  return (
    <>
      <div className="editor-title-row">
        <div>
          <h3>{productId ? '编辑福利产品' : '新增福利产品'}</h3>
          <p>按页面顺序填写，保存草稿并预览后再上架。</p>
        </div>
        <button className="secondary-button" onClick={onClose} type="button">返回产品列表</button>
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}

      <form className="content-editor" onSubmit={save}>
        <div className="editor-section-heading">
          <span>1</span>
          <div><h3>基本信息</h3><p>用于会员福利列表和详情页顶部。</p></div>
        </div>
        <label className="editor-field">
          产品名称
          <input required maxLength={100} value={name} onChange={(event) => {
            setName(event.target.value)
            markDirty()
          }} />
        </label>
        <label className="editor-field">
          简短介绍
          <textarea required maxLength={300} rows={3} value={summary} onChange={(event) => {
            setSummary(event.target.value)
            markDirty()
          }} />
          <small className="field-help">建议 30 至 80 字，用于列表卡片。</small>
        </label>
        <div className="two-column-fields">
          <label className="editor-field">
            产品分类（选填）
            <select value={categoryId} onChange={(event) => {
              setCategoryId(event.target.value)
              markDirty()
            }}>
              <option value="">不分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}{category.status === 'ONLINE' ? '' : '（未启用）'}
                </option>
              ))}
            </select>
            <small className="field-help">分类用于会员筛选，不影响产品本身能否上架。</small>
          </label>
          <label className="editor-field">
            展示顺序
            <input min={0} max={10000} type="number" value={displayOrder} onChange={(event) => {
              setDisplayOrder(Number(event.target.value))
              markDirty()
            }} />
            <small className="field-help">数字越小越靠前。</small>
          </label>
        </div>

        <div className="editor-section-heading">
          <span>2</span>
          <div><h3>产品图片与列表封面</h3><p>最多上传 10 张图片，再从中选择一张作为产品列表封面。</p></div>
        </div>
        <section className="product-image-editor" aria-labelledby="product-images-title">
          <div className="block-heading">
            <div>
              <h3 id="product-images-title">已上传图片</h3>
              <p>列表只展示选中的封面；进入产品详情后，可以左右滑动查看这里的全部图片。</p>
            </div>
            <span className="gallery-count">已添加 {listImageMediaIds.length} / 10 张</span>
          </div>
          {listImageMediaIds.length > 0 && (
            <div className="product-image-list">
              {listImageMediaIds.map((mediaId, imageIndex) => (
                <article className={`product-image-item${coverMediaId === mediaId ? ' product-image-item--cover' : ''}`} key={mediaId}>
                  <MediaPreview alt={`产品图片 ${imageIndex + 1}`} mediaId={mediaId} />
                  <div className="product-image-item__footer">
                    <label className="product-cover-choice">
                      <input
                        checked={coverMediaId === mediaId}
                        name="product-cover"
                        onChange={() => {
                          setCoverMediaId(mediaId)
                          markDirty()
                        }}
                        type="radio"
                      />
                      {coverMediaId === mediaId ? '当前列表封面' : '设为列表封面'}
                    </label>
                    <button
                      aria-label={`删除第 ${imageIndex + 1} 张产品图片`}
                      className="icon-text-button danger"
                      onClick={() => {
                        const next = listImageMediaIds.filter((_, index) => index !== imageIndex)
                        setListImageMediaIds(next)
                        if (coverMediaId === mediaId) setCoverMediaId(next[0] ?? '')
                        markDirty()
                      }}
                      type="button"
                    >删除</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {listImageMediaIds.length < 10 && (
            <div className="product-image-uploader">
              <MediaUploadField
                key={listImageUploadKey}
                accept="image/jpeg,image/png,image/webp"
                label={listImageMediaIds.length === 0 ? '上传第一张产品图片' : '继续添加产品图片'}
                mediaType="IMAGE"
                onReady={(media) => {
                  setListImageMediaIds((current) => [...current, media.id])
                  if (!coverMediaId) setCoverMediaId(media.id)
                  setListImageUploadKey((current) => current + 1)
                  markDirty()
                }}
                purpose="PRODUCT_IMAGE"
              />
            </div>
          )}
        </section>

        <div className="editor-section-heading">
          <span>3</span>
          <div><h3>产品详情（选填）</h3><p>可以不填写；也可以按展示顺序添加文字和多张详情图片。</p></div>
        </div>
        <div className="content-blocks">
          {blocks.map((block, index) => (
            <div className="content-block" key={index}>
              <div className="block-toolbar">
                <select value={block.type} onChange={(event) => updateBlock(index, {
                  type: event.target.value as ProductContentBlock['type'],
                  text: event.target.value === 'IMAGE' ? undefined : block.text ?? '',
                  mediaId: event.target.value === 'IMAGE' ? block.mediaId : undefined,
                  altText: event.target.value === 'IMAGE' ? block.altText : undefined,
                })}>
                  <option value="HEADING">小标题</option>
                  <option value="PARAGRAPH">正文</option>
                  <option value="IMAGE">图片</option>
                </select>
                <span>详情内容 {index + 1}</span>
                <button className="icon-text-button" disabled={index === 0} onClick={() => moveBlock(index, -1)} type="button">上移</button>
                <button className="icon-text-button" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} type="button">下移</button>
                <button className="icon-text-button danger" onClick={() => {
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
                    purpose="PRODUCT_IMAGE"
                  />
                  <input maxLength={255} placeholder="图片说明（选填）" value={block.altText ?? ''} onChange={(event) => updateBlock(index, { altText: event.target.value })} />
                </>
              ) : (
                <textarea maxLength={10000} rows={block.type === 'HEADING' ? 2 : 6} value={block.text ?? ''} onChange={(event) => updateBlock(index, { text: event.target.value })} />
              )}
            </div>
          ))}
        </div>
        <div className="section-add-actions">
          <button className="secondary-button" onClick={() => {
            setBlocks((current) => [...current, { type: 'PARAGRAPH', text: '' }])
            markDirty()
          }} type="button">添加文字</button>
          <button className="secondary-button" onClick={() => {
            setBlocks((current) => [...current, { type: 'IMAGE', altText: '' }])
            markDirty()
          }} type="button">添加图片</button>
        </div>

        <div className="editor-section-heading">
          <span>4</span>
          <div><h3>规格说明（选填）</h3><p>仅展示包装、尺寸等信息，不提供购买或领取入口。</p></div>
        </div>
        <label className="editor-field">
          规格说明
          <textarea maxLength={2000} placeholder="例如：每盒 2 件；图片仅供参考" rows={4} value={specification} onChange={(event) => {
            setSpecification(event.target.value)
            markDirty()
          }} />
        </label>

        {publicationProblems.length > 0 && (
          <div className="publication-checklist" role="status">
            <strong>上架前还需要：</strong>
            <span>{publicationProblems.join('、')}</span>
          </div>
        )}
        <div className="editor-actions">
          <button className="primary-button" disabled={busy || !dirty} type="submit">{busy ? '处理中…' : '保存草稿'}</button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">预览草稿</button>
          <button className="secondary-button publish-button" disabled={busy || dirty || !content?.draft || publicationProblems.length > 0} onClick={() => void publish()} type="button">上架</button>
          {content?.visibility === 'PUBLISHED' && (
            <button className="secondary-button danger-button" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>
          )}
        </div>
        {dirty && <p className="unsaved-indicator">修改尚未保存。预览和上架前请先保存草稿。</p>}
      </form>

      {preview && (
        <div className="modal-backdrop" role="presentation">
          <article aria-modal="true" className="modal-card content-preview" role="dialog">
            <div className="modal-header">
              <div><p className="eyebrow">福利产品草稿预览</p><h2>{preview.name}</h2></div>
              <button aria-label="关闭预览" className="icon-button" onClick={() => setPreview(undefined)} type="button">×</button>
            </div>
            <MediaPreview alt={preview.name} mediaId={preview.coverMediaId} />
            <p className="preview-summary">{preview.summary}</p>
            {preview.blocks.length > 0 && (
              <div className="preview-body">
                {preview.blocks.map((block, index) => {
                  if (block.type === 'HEADING') return <h3 key={index}>{block.text}</h3>
                  if (block.type === 'IMAGE') return <MediaPreview alt={block.altText} key={index} mediaId={block.mediaId} />
                  return <p key={index}>{block.text}</p>
                })}
              </div>
            )}
            {preview.specification && <p className="preview-summary"><strong>规格说明：</strong>{preview.specification}</p>}
          </article>
        </div>
      )}
    </>
  )
}
