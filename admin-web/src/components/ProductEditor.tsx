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
import { AdminIcon } from './AdminIcon'
import { MediaPreview } from './MediaPreview'
import { MediaUploadField } from './MediaUploadField'
import { PageIntro } from './PageIntro'
import { MobilePreview } from './MobilePreview'

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

type ProductEditorPanel = 'BASIC' | 'IMAGES' | 'DETAIL'
type ProductPreviewMode = 'LIST' | 'DETAIL'

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
  const [activePanel, setActivePanel] = useState<ProductEditorPanel>('BASIC')
  const [previewMode, setPreviewMode] = useState<ProductPreviewMode>('LIST')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(Boolean(productId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const markDirty = useCallback(() => {
    setDirty(true)
    setNotice('')
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
    if (!name.trim() || !summary.trim()) {
      setActivePanel('BASIC')
      setError('请先填写产品名称和简短介绍。')
      return
    }
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

  function closeEditor() {
    if (dirty && !window.confirm('福利产品还有修改没有保存，确定返回列表吗？')) return
    onDirtyChange(false)
    onClose()
  }

  if (loading) return <p className="empty-state">正在加载福利产品…</p>

  const currentProductId = content?.id ?? productId

  return (
    <section className="product-editor-page">
      <div className="page-heading-row product-editor-heading">
        <div className="product-editor-heading__title">
          <button aria-label="返回产品列表" className="video-editor-back" onClick={closeEditor} type="button">←</button>
          <PageIntro
            title={currentProductId ? '编辑福利产品' : '新增福利产品'}
            description="维护会员端双列产品卡片、产品相册与选填详情。"
          />
          <span className={`status-pill ${content?.visibility === 'PUBLISHED' ? 'active' : 'disabled'}`}>
            {content?.visibility === 'PUBLISHED' ? '已上架' : content?.firstPublishedAt ? '已下架' : '草稿'}
          </span>
        </div>
        <div className="product-page-actions">
          <button className="secondary-button" disabled={busy || !dirty} form="product-content-form" type="submit">{busy ? '处理中…' : '保存草稿'}</button>
          <button className="secondary-button" disabled={busy || dirty || !content?.draft} onClick={() => void showPreview()} type="button">预览草稿</button>
          <button className="primary-button" disabled={busy || dirty || !content?.draft || publicationProblems.length > 0} onClick={() => void publish()} type="button">上架</button>
          {content?.visibility === 'PUBLISHED' && <button className="text-button danger" disabled={busy} onClick={() => void unpublish()} type="button">下架</button>}
        </div>
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}

      <div className="product-editor-layout">
        <form className="product-compact-editor" id="product-content-form" onSubmit={save}>
          <div aria-label="福利产品编辑内容" className="company-editor-tabs" role="tablist">
            <button aria-selected={activePanel === 'BASIC'} className={activePanel === 'BASIC' ? 'active' : ''} onClick={() => setActivePanel('BASIC')} role="tab" type="button">基础信息</button>
            <button aria-selected={activePanel === 'IMAGES'} className={activePanel === 'IMAGES' ? 'active' : ''} onClick={() => setActivePanel('IMAGES')} role="tab" type="button">产品图片 <span>{listImageMediaIds.length}</span></button>
            <button aria-selected={activePanel === 'DETAIL'} className={activePanel === 'DETAIL' ? 'active' : ''} onClick={() => setActivePanel('DETAIL')} role="tab" type="button">详情内容 <span>{blocks.length || '选填'}</span></button>
          </div>

          <div className="company-version-strip">
            <span><small>线上版本</small><strong>{content?.published ? `第 ${content.published.revisionNumber} 版` : '暂无'}</strong></span>
            <i />
            <span><small>当前草稿</small><strong>{content?.draft ? `第 ${content.draft.revisionNumber} 版` : '尚未保存'}</strong></span>
            <i />
            <span><small>上架条件</small><strong>{publicationProblems.length === 0 ? '已满足' : `还差 ${publicationProblems.length} 项`}</strong></span>
          </div>

          {activePanel === 'BASIC' && (
            <section className="product-editor-panel">
              <div className="compact-editor-heading">
                <span><AdminIcon name="gift" /></span>
                <div><h3>产品基本信息</h3><p>名称和简介用于会员福利列表及详情页。</p></div>
              </div>
              <div className="product-basic-fields">
                <label className="editor-field product-inline-field">
                  <span>产品名称</span>
                  <input aria-label="产品名称" maxLength={100} onChange={(event) => { setName(event.target.value); markDirty() }} placeholder="输入产品名称" required value={name} />
                </label>
                <label className="editor-field product-inline-field product-summary-field">
                  <span>简短介绍</span>
                  <textarea aria-label="简短介绍" maxLength={300} onChange={(event) => { setSummary(event.target.value); markDirty() }} placeholder="建议 30 至 80 字，用于双列产品卡片" required rows={3} value={summary} />
                </label>
                <div className="two-column-fields product-meta-fields">
                  <label className="editor-field">
                    产品分类（选填）
                    <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); markDirty() }}>
                      <option value="">不分类</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.status === 'ONLINE' ? '' : '（未启用）'}</option>)}
                    </select>
                    <small className="field-help">分类只用于会员端筛选。</small>
                  </label>
                  <label className="editor-field">
                    展示顺序
                    <input max={10000} min={0} onChange={(event) => { setDisplayOrder(Number(event.target.value)); markDirty() }} type="number" value={displayOrder} />
                    <small className="field-help">数字越小越靠前。</small>
                  </label>
                </div>
                <label className="editor-field product-specification-field">
                  规格说明（选填）
                  <textarea maxLength={2000} onChange={(event) => { setSpecification(event.target.value); markDirty() }} placeholder="例如：每盒 2 件；图片仅供参考" rows={3} value={specification} />
                </label>
              </div>
            </section>
          )}

          {activePanel === 'IMAGES' && (
            <section className="product-editor-panel">
              <div className="product-panel-heading">
                <div className="compact-editor-heading">
                  <span><AdminIcon name="hero" /></span>
                  <div><h3>产品图片与列表封面</h3><p>详情页可左右滑动全部图片，列表仅展示选中的封面。</p></div>
                </div>
                <span className="gallery-count">{listImageMediaIds.length} / 10 张</span>
              </div>
              {listImageMediaIds.length > 0 && (
                <div className="product-image-list compact-product-image-list">
                  {listImageMediaIds.map((mediaId, imageIndex) => (
                    <article className={`product-image-item${coverMediaId === mediaId ? ' product-image-item--cover' : ''}`} key={mediaId}>
                      <MediaPreview alt={`产品图片 ${imageIndex + 1}`} mediaId={mediaId} />
                      <div className="product-image-item__footer">
                        <label className="product-cover-choice">
                          <input checked={coverMediaId === mediaId} name="product-cover" onChange={() => { setCoverMediaId(mediaId); markDirty() }} type="radio" />
                          {coverMediaId === mediaId ? '当前列表封面' : '设为列表封面'}
                        </label>
                        <button aria-label={`删除第 ${imageIndex + 1} 张产品图片`} className="icon-text-button danger" onClick={() => {
                          const next = listImageMediaIds.filter((_, index) => index !== imageIndex)
                          setListImageMediaIds(next)
                          if (coverMediaId === mediaId) setCoverMediaId(next[0] ?? '')
                          markDirty()
                        }} type="button">删除</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {listImageMediaIds.length < 10 && (
                <div className="product-image-uploader compact-product-image-uploader">
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
          )}

          {activePanel === 'DETAIL' && (
            <section className="product-editor-panel">
              <div className="product-panel-heading">
                <div className="compact-editor-heading">
                  <span><AdminIcon name="company" /></span>
                  <div><h3>产品详情（选填）</h3><p>不填写时，详情页只展示产品图片、名称和简介。</p></div>
                </div>
                <div className="section-add-actions">
                  <button className="secondary-button" onClick={() => { setBlocks((current) => [...current, { type: 'PARAGRAPH', text: '' }]); markDirty() }} type="button">＋ 添加文字</button>
                  <button className="secondary-button" onClick={() => { setBlocks((current) => [...current, { type: 'IMAGE', altText: '' }]); markDirty() }} type="button">＋ 添加图片</button>
                </div>
              </div>
              {blocks.length === 0 && <p className="product-detail-empty">当前未设置产品详情，小程序将只显示产品基本信息。</p>}
              <div className="content-blocks product-content-blocks">
                {blocks.map((block, index) => (
                  <div className="content-block product-content-block" key={index}>
                    <div className="block-toolbar">
                      <select aria-label={`第 ${index + 1} 项详情类型`} value={block.type} onChange={(event) => updateBlock(index, {
                        type: event.target.value as ProductContentBlock['type'],
                        text: event.target.value === 'IMAGE' ? undefined : block.text ?? '',
                        mediaId: event.target.value === 'IMAGE' ? block.mediaId : undefined,
                        altText: event.target.value === 'IMAGE' ? block.altText : undefined,
                      })}>
                        <option value="HEADING">小标题</option>
                        <option value="PARAGRAPH">正文</option>
                        <option value="IMAGE">图片</option>
                      </select>
                      <span>详情 {String(index + 1).padStart(2, '0')}</span>
                      <button className="icon-text-button" disabled={index === 0} onClick={() => moveBlock(index, -1)} type="button">上移</button>
                      <button className="icon-text-button" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} type="button">下移</button>
                      <button className="icon-text-button danger" onClick={() => { setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index)); markDirty() }} type="button">删除</button>
                    </div>
                    {block.type === 'IMAGE' ? (
                      <div className="product-block-image-fields">
                        <MediaUploadField accept="image/jpeg,image/png,image/webp" label={`详情图片 ${index + 1}`} mediaId={block.mediaId} mediaType="IMAGE" onReady={(media) => updateBlock(index, { mediaId: media.id })} purpose="PRODUCT_IMAGE" />
                        <input aria-label={`第 ${index + 1} 张详情图片说明`} maxLength={255} onChange={(event) => updateBlock(index, { altText: event.target.value })} placeholder="图片说明（选填）" value={block.altText ?? ''} />
                      </div>
                    ) : (
                      <textarea aria-label={`第 ${index + 1} 项详情文字`} maxLength={10000} onChange={(event) => updateBlock(index, { text: event.target.value })} placeholder={block.type === 'HEADING' ? '输入详情小标题' : '输入产品详情文字'} rows={block.type === 'HEADING' ? 2 : 4} value={block.text ?? ''} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {publicationProblems.length > 0 && (
            <div className="publication-checklist compact-publication-checklist" role="status"><strong>上架前还需要：</strong><span>{publicationProblems.join('、')}</span></div>
          )}
          <div className="hero-draft-note">
            <span aria-hidden="true">i</span>
            {dirty ? '修改尚未保存。预览和上架前请先保存草稿。' : '草稿不会影响小程序，上架后才会更新会员福利。'}
          </div>
        </form>

        <MobilePreview><aside className="product-mini-preview">
          <div className="company-preview-heading">
            <div><span aria-hidden="true">▯</span><strong>小程序预览</strong></div>
            <div className="company-preview-switch" role="group" aria-label="产品预览页面">
              <button className={previewMode === 'LIST' ? 'active' : ''} onClick={() => setPreviewMode('LIST')} type="button">双列卡片</button>
              <button className={previewMode === 'DETAIL' ? 'active' : ''} onClick={() => setPreviewMode('DETAIL')} type="button">详情页</button>
            </div>
          </div>
          <div className="hero-phone-preview product-phone-preview">
            <div className="hero-phone-preview__status"><strong>9:41</strong><span>● ◒ ▰</span></div>
            <div className="hero-phone-preview__nav"><strong>{previewMode === 'LIST' ? '会员福利' : '福利详情'}</strong><span>•••　◉</span></div>
            {previewMode === 'LIST' ? (
              <div className="product-phone-preview__list">
                <div className="product-phone-preview__search">搜索福利产品</div>
                <div className="product-phone-preview__grid">
                  <div className="product-phone-preview__card">
                    <div className="product-phone-preview__card-image">{coverMediaId ? <MediaPreview alt={name || '产品封面'} mediaId={coverMediaId} /> : <span>产品封面</span>}</div>
                    <strong>{name || '产品名称'}</strong><p>{summary || '产品简介将在这里展示'}</p><small>查看详情　›</small>
                  </div>
                  <div className="product-phone-preview__card placeholder"><div /><strong>更多福利</strong><p>会员精选产品</p><small>查看详情　›</small></div>
                </div>
              </div>
            ) : (
              <div className="product-phone-preview__detail">
                <div className="product-phone-preview__hero">{listImageMediaIds[0] ? <MediaPreview alt={name || '产品图片'} mediaId={listImageMediaIds[0]} /> : <span>产品图片</span>}</div>
                <div className="product-phone-preview__intro"><strong>{name || '产品名称'}</strong><p>{summary || '产品简介将在这里展示。'}</p></div>
                {blocks.filter(hasBlockContent).length > 0 && <div className="product-phone-preview__body">
                  {blocks.filter(hasBlockContent).slice(0, 3).map((block, index) => {
                    if (block.type === 'HEADING') return <strong key={index}>{block.text}</strong>
                    if (block.type === 'IMAGE') return <MediaPreview alt={block.altText || '详情图片'} key={index} mediaId={block.mediaId} />
                    return <p key={index}>{block.text}</p>
                  })}
                </div>}
                {specification && <div className="product-phone-preview__spec"><small>规格说明</small><p>{specification}</p></div>}
              </div>
            )}
          </div>
        </aside></MobilePreview>
      </div>

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
    </section>
  )
}
