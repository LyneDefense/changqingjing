import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import {
  AdminApiError,
  deleteAdminScenic,
  publishAdminScenic,
  searchAdminScenics,
  unpublishAdminScenic,
} from '../api/admin'
import type {
  AdminScenicListItem,
  PageResponse,
  ScenicPublicationStatus,
} from '../api/admin'
import { MediaPreview } from '../components/MediaPreview'
import { PageIntro } from '../components/PageIntro'
import { ScenicEditor } from '../components/ScenicEditor'

const emptyPage: PageResponse<AdminScenicListItem> = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
}

const publicationText: Record<ScenicPublicationStatus, string> = {
  DRAFT: '草稿',
  ONLINE: '展示中',
  OFFLINE: '已下架',
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message + (error.traceId ? `（追踪号：${error.traceId}）` : '')
  }
  return '景区内容操作失败，请稍后重试'
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function ScenicPage() {
  const [result, setResult] = useState(emptyPage)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'' | ScenicPublicationStatus>('')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>()
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const blocker = useBlocker(dirty)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await searchAdminScenics({ keyword, status, page }))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [keyword, page, status])

  useEffect(() => {
    // Query changes are the effect's synchronization target.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('景区内容还有修改没有保存，确定离开吗？')) blocker.proceed()
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

  async function publish(item: AdminScenicListItem) {
    if (!window.confirm(`发布“${item.title}”后，小程序会立即展示。确认发布吗？`)) return
    setBusyId(item.id)
    setError('')
    try {
      await publishAdminScenic(item.id, item.version)
      setNotice('景区介绍已发布。')
      await load()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function unpublish(item: AdminScenicListItem) {
    if (!window.confirm(`下架“${item.title}”后，小程序将立即隐藏。确认下架吗？`)) return
    setBusyId(item.id)
    setError('')
    try {
      await unpublishAdminScenic(item.id, item.version)
      setNotice('景区介绍已下架。')
      await load()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function remove(item: AdminScenicListItem) {
    if (!window.confirm(`确认删除“${item.title}”吗？删除后无法恢复。`)) return
    setBusyId(item.id)
    setError('')
    try {
      await deleteAdminScenic(item.id, item.version)
      setNotice('景区介绍已删除。')
      await load()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  if (editingId !== undefined) {
    return (
      <>
        <PageIntro
          title="景区管理"
          description="维护景区图文、开放状态和首页顺序；导航位置按需配置。"
        />
        <ScenicEditor
          onChanged={() => void load()}
          onClose={() => setEditingId(undefined)}
          onDirtyChange={setDirty}
          scenicId={editingId ?? undefined}
        />
      </>
    )
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  return (
    <>
      <div className="page-heading-row">
        <PageIntro
          title="景区管理"
          description="维护小程序中的景区介绍、开放状态、首页顺序和导航目的地。"
        />
        <button className="primary-button" onClick={() => setEditingId(null)} type="button">新增景区</button>
      </div>
      <form className="filter-bar" onSubmit={search}>
        <label>
          <span className="visually-hidden">搜索景区名称</span>
          <input placeholder="搜索景区名称" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} />
        </label>
        <label>
          <span className="visually-hidden">发布状态</span>
          <select value={status} onChange={(event) => {
            setStatus(event.target.value as '' | ScenicPublicationStatus)
            setPage(1)
          }}>
            <option value="">全部状态</option>
            <option value="ONLINE">展示中</option>
            <option value="DRAFT">草稿</option>
            <option value="OFFLINE">已下架</option>
          </select>
        </label>
        <button className="secondary-button" type="submit">搜索</button>
      </form>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}

      <div className="table-card">
        <table>
          <thead><tr><th>景区</th><th>内容状态</th><th>开放状态</th><th>浏览量</th><th>最近更新</th><th><span className="visually-hidden">操作</span></th></tr></thead>
          <tbody>
            {!loading && result.items.length === 0 && (
              <tr><td className="empty-state" colSpan={6}>暂无景区内容，点击“新增景区”开始创建。</td></tr>
            )}
            {result.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="video-list-title">
                    {item.coverMediaId && <div className="video-list-cover"><MediaPreview alt={item.title} mediaId={item.coverMediaId} /></div>}
                    <div><strong>{item.title}</strong><small>首页顺序：{item.displayOrder}{item.hasUnpublishedChanges ? ' · 有未发布修改' : ''}</small></div>
                  </div>
                </td>
                <td><span className={`status-pill ${item.status === 'ONLINE' ? 'active' : 'disabled'}`}>{publicationText[item.status]}</span></td>
                <td><span className={`status-pill ${item.openStatus === 'OPEN' ? 'active' : 'paused'}`}>{item.openStatus === 'OPEN' ? '正常开放' : '暂停开放'}</span></td>
                <td>{item.viewCount}</td>
                <td>{formatTime(item.updatedAt)}</td>
                <td>
                  <div className="row-actions">
                    <button className="text-button" disabled={Boolean(busyId)} onClick={() => setEditingId(item.id)} type="button">编辑</button>
                    {item.status !== 'ONLINE' && <button className="text-button" disabled={Boolean(busyId)} onClick={() => void publish(item)} type="button">发布</button>}
                    {item.status === 'ONLINE' && <button className="text-button" disabled={Boolean(busyId)} onClick={() => void unpublish(item)} type="button">下架</button>}
                    {item.status !== 'ONLINE' && <button className="text-button danger" disabled={Boolean(busyId)} onClick={() => void remove(item)} type="button">删除</button>}
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
  )
}
