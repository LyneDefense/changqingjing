import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import {
  AdminApiError,
  createAdminProductCategory,
  deleteAdminProduct,
  getAdminProductCategories,
  publishAdminProduct,
  publishAdminProductCategory,
  saveAdminProductCategory,
  searchAdminProducts,
  unpublishAdminProduct,
  unpublishAdminProductCategory,
} from '../api/admin'
import type {
  AdminProductCategory,
  AdminProductListItem,
  PageResponse,
  ProductPublicationStatus,
} from '../api/admin'
import { MediaPreview } from '../components/MediaPreview'
import { PageIntro } from '../components/PageIntro'
import { ProductEditor } from '../components/ProductEditor'

const emptyPage: PageResponse<AdminProductListItem> = {
  items: [], page: 1, pageSize: 20, total: 0,
}

const publicationText: Record<ProductPublicationStatus, string> = {
  DRAFT: '草稿',
  ONLINE: '已上架',
  OFFLINE: '已下架',
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message + (error.traceId ? `（追踪号：${error.traceId}）` : '')
  }
  return '会员福利操作失败，请稍后重试'
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
}

interface CategoryFormState {
  id?: string
  name: string
  displayOrder: number
  expectedVersion: number
}

export function ProductPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products')
  const [result, setResult] = useState(emptyPage)
  const [categories, setCategories] = useState<AdminProductCategory[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'' | ProductPublicationStatus>('')
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>()
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>()
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const blocker = useBlocker(dirty)

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await getAdminProductCategories())
    } catch (requestError) {
      setError(errorText(requestError))
    }
  }, [])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await searchAdminProducts({ keyword, status, categoryId, page }))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [categoryId, keyword, page, status])

  useEffect(() => {
    // Filter state is synchronized with the two backend lists here.
    // oxlint-disable-next-line react/set-state-in-effect
    void Promise.all([loadProducts(), loadCategories()])
  }, [loadCategories, loadProducts])

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('福利产品还有修改没有保存，确定离开吗？')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useBeforeUnload((event) => {
    if (dirty) event.preventDefault()
  })

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setKeyword(keywordInput.trim())
    setPage(1)
  }

  async function publishProduct(item: AdminProductListItem) {
    if (!window.confirm(`上架“${item.name}”后，已登录会员会立即看到。确认上架吗？`)) return
    setBusyId(item.id)
    setError('')
    try {
      await publishAdminProduct(item.id, item.version)
      setNotice('福利产品已上架。')
      await loadProducts()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function unpublishProduct(item: AdminProductListItem) {
    if (!window.confirm(`下架“${item.name}”后，会员将立即无法查看。确认下架吗？`)) return
    setBusyId(item.id)
    setError('')
    try {
      await unpublishAdminProduct(item.id, item.version)
      setNotice('福利产品已下架。')
      await loadProducts()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function removeProduct(item: AdminProductListItem) {
    if (!window.confirm(`确认删除“${item.name}”吗？删除后无法恢复。`)) return
    setBusyId(item.id)
    setError('')
    try {
      await deleteAdminProduct(item.id, item.version)
      setNotice('福利产品已删除。')
      await loadProducts()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!categoryForm) return
    setBusyId(categoryForm.id ?? 'new-category')
    setError('')
    try {
      if (categoryForm.id) {
        await saveAdminProductCategory(categoryForm.id, categoryForm)
      } else {
        await createAdminProductCategory(categoryForm)
      }
      setCategoryForm(undefined)
      setNotice('分类草稿已保存。需要点击“启用”后才会显示给会员。')
      await loadCategories()
      await loadProducts()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function publishCategory(category: AdminProductCategory) {
    const action = category.status === 'ONLINE' ? '发布分类名称或顺序的修改' : '启用这个分类'
    if (!window.confirm(`确认${action}吗？`)) return
    setBusyId(category.id)
    setError('')
    try {
      await publishAdminProductCategory(category.id, category.version)
      setNotice(category.status === 'ONLINE' ? '分类修改已发布。' : '分类已启用。')
      await loadCategories()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function unpublishCategory(category: AdminProductCategory) {
    if (!window.confirm('停用分类只会隐藏分类筛选入口，不会下架分类下的产品。确认停用吗？')) return
    setBusyId(category.id)
    setError('')
    try {
      await unpublishAdminProductCategory(category.id, category.version)
      setNotice('分类已停用，所属产品仍保持原上架状态。')
      await loadCategories()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  if (editingId !== undefined) {
    return (
      <div className="product-admin-page">
        <ProductEditor
          categories={categories}
          onChanged={() => void Promise.all([loadProducts(), loadCategories()])}
          onClose={() => setEditingId(undefined)}
          onDirtyChange={setDirty}
          productId={editingId ?? undefined}
        />
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  return (
    <div className="product-admin-page">
      <div className="page-heading-row product-page-heading">
        <PageIntro
          title="会员福利管理"
          description="运营人员可在这里维护福利产品；产品只做图文展示，不包含购买或领取功能。"
        />
        {activeTab === 'products' && (
          <button className="primary-button" onClick={() => setEditingId(null)} type="button">＋ 新增福利产品</button>
        )}
        {activeTab === 'categories' && (
          <button className="primary-button" onClick={() => setCategoryForm({ name: '', displayOrder: 0, expectedVersion: 0 })} type="button">＋ 新增分类</button>
        )}
      </div>

      <div aria-label="会员福利管理子栏目" className="section-tabs" role="tablist">
        <button aria-selected={activeTab === 'products'} className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')} role="tab" type="button">福利产品管理</button>
        <button aria-selected={activeTab === 'categories'} className={activeTab === 'categories' ? 'active' : ''} onClick={() => setActiveTab('categories')} role="tab" type="button">产品分类设置</button>
      </div>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}

      {activeTab === 'products' ? (
        <>
          <form className="filter-bar product-filter-bar" onSubmit={search}>
            <label className="video-search-field">
              <span className="visually-hidden">搜索产品名称</span>
              <span aria-hidden="true" className="video-search-field__icon">⌕</span>
              <input placeholder="搜索产品名称" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} />
            </label>
            <label>
              <span className="visually-hidden">上架状态</span>
              <select value={status} onChange={(event) => {
                setStatus(event.target.value as '' | ProductPublicationStatus)
                setPage(1)
              }}>
                <option value="">全部状态</option>
                <option value="ONLINE">已上架</option>
                <option value="DRAFT">草稿</option>
                <option value="OFFLINE">已下架</option>
              </select>
            </label>
            <label>
              <span className="visually-hidden">产品分类</span>
              <select value={categoryId} onChange={(event) => {
                setCategoryId(event.target.value)
                setPage(1)
              }}>
                <option value="">全部分类</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <button className="secondary-button" type="submit">搜索</button>
          </form>

          <div className="table-card product-table-card">
            <div className="video-table-summary">
              <div>
                <strong>福利产品</strong>
                <span>共 {result.total} 条记录</span>
              </div>
              <small>会员端以双列卡片展示已上架产品</small>
            </div>
            <table>
              <thead><tr><th>福利产品</th><th>分类</th><th>上架状态</th><th>最近更新</th><th><span className="visually-hidden">操作</span></th></tr></thead>
              <tbody>
                {!loading && result.items.length === 0 && (
                  <tr><td className="empty-state" colSpan={5}>暂无福利产品，点击“新增福利产品”开始创建。</td></tr>
                )}
                {result.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="video-list-title">
                        {item.coverMediaId && <div className="video-list-cover"><MediaPreview alt={item.name} mediaId={item.coverMediaId} /></div>}
                        <div><strong>{item.name}</strong><small>展示顺序：{item.displayOrder}{item.hasUnpublishedChanges ? ' · 有未上架修改' : ''}</small></div>
                      </div>
                    </td>
                    <td>{item.categoryName ?? '未分类'}</td>
                    <td><span className={`status-pill ${item.status === 'ONLINE' ? 'active' : 'disabled'}`}>{publicationText[item.status]}</span></td>
                    <td>{formatTime(item.updatedAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="text-button" disabled={Boolean(busyId)} onClick={() => setEditingId(item.id)} type="button">编辑</button>
                        {item.status !== 'ONLINE' && <button className="text-button" disabled={Boolean(busyId)} onClick={() => void publishProduct(item)} type="button">上架</button>}
                        {item.status === 'ONLINE' && <button className="text-button" disabled={Boolean(busyId)} onClick={() => void unpublishProduct(item)} type="button">下架</button>}
                        {item.status !== 'ONLINE' && <button className="text-button danger" disabled={Boolean(busyId)} onClick={() => void removeProduct(item)} type="button">删除</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button className="secondary-button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">上一页</button>
            <span>第 {page} / {totalPages} 页，共 {result.total} 条</span>
            <button className="secondary-button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} type="button">下一页</button>
          </div>
        </>
      ) : (
        <>
          <p className="notice warning-notice">分类是可选筛选项。停用分类只隐藏会员端的分类入口，不会下架这个分类中的产品。</p>
          <div className="table-card category-table product-category-table">
            <div className="video-table-summary">
              <div><strong>产品分类</strong><span>共 {categories.length} 个分类</span></div>
              <small>分类仅用于会员端筛选</small>
            </div>
            <table>
              <thead><tr><th>分类名称</th><th>展示顺序</th><th>状态</th><th>最近更新</th><th><span className="visually-hidden">操作</span></th></tr></thead>
              <tbody>
                {categories.length === 0 && <tr><td className="empty-state" colSpan={5}>暂未设置分类。产品也可以保持“未分类”。</td></tr>}
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td><strong>{category.name}</strong>{category.hasUnpublishedChanges && <small>有未发布修改</small>}</td>
                    <td>{category.displayOrder}</td>
                    <td><span className={`status-pill ${category.status === 'ONLINE' ? 'active' : 'disabled'}`}>{category.status === 'ONLINE' ? '已启用' : '未启用'}</span></td>
                    <td>{formatTime(category.updatedAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="text-button" disabled={Boolean(busyId)} onClick={() => setCategoryForm({ id: category.id, name: category.name, displayOrder: category.displayOrder, expectedVersion: category.version })} type="button">编辑</button>
                        {(category.status !== 'ONLINE' || category.hasUnpublishedChanges) && <button className="text-button" disabled={Boolean(busyId)} onClick={() => void publishCategory(category)} type="button">{category.status === 'ONLINE' ? '发布修改' : '启用'}</button>}
                        {category.status === 'ONLINE' && <button className="text-button danger" disabled={Boolean(busyId)} onClick={() => void unpublishCategory(category)} type="button">停用</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {categoryForm && (
        <div className="modal-backdrop" role="presentation">
          <form aria-modal="true" className="modal-card form-stack" onSubmit={(event) => void saveCategory(event)} role="dialog">
            <div className="modal-header">
              <div><p className="eyebrow">产品分类设置</p><h2>{categoryForm.id ? '编辑分类' : '新增分类'}</h2></div>
              <button aria-label="关闭" className="icon-button" onClick={() => setCategoryForm(undefined)} type="button">×</button>
            </div>
            <label>分类名称<input autoFocus maxLength={50} required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /></label>
            <label>展示顺序<input max={10000} min={0} type="number" value={categoryForm.displayOrder} onChange={(event) => setCategoryForm({ ...categoryForm, displayOrder: Number(event.target.value) })} /><small className="field-help">数字越小越靠前。</small></label>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setCategoryForm(undefined)} type="button">取消</button>
              <button className="primary-button" disabled={Boolean(busyId)} type="submit">保存分类草稿</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
