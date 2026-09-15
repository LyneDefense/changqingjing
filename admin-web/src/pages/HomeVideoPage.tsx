import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import {
  AdminApiError,
  deleteAdminHomeVideo,
  publishAdminHomeVideo,
  searchAdminHomeVideos,
  unpublishAdminHomeVideo,
} from '../api/admin'
import type {
  AdminHomeVideoListItem,
  HomeVideoStatus,
  PageResponse,
} from '../api/admin'
import { HomeVideoEditor } from '../components/HomeVideoEditor'
import { MediaPreview } from '../components/MediaPreview'
import { PageIntro } from '../components/PageIntro'

const emptyPage: PageResponse<AdminHomeVideoListItem> = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
}

const statusText: Record<HomeVideoStatus, string> = {
  DRAFT: '草稿',
  ONLINE: '首页展示中',
  OFFLINE: '已下架',
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message + (error.traceId ? '（追踪号：' + error.traceId + '）' : '')
  }
  return '宣传视频操作失败，请稍后重试'
}

function formatTime(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function HomeVideoPage() {
  const [result, setResult] = useState(emptyPage)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'' | HomeVideoStatus>('')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>()
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const blocker = useBlocker(dirty)

  const loadVideos = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await searchAdminHomeVideos({ keyword, status, page }))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [keyword, page, status])

  useEffect(() => {
    // Query changes are the effect's synchronization target.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadVideos()
  }, [loadVideos])

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('宣传视频还有修改没有保存，确定离开吗？')) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker])

  useBeforeUnload((event) => {
    if (dirty) event.preventDefault()
  })

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  async function publish(item: AdminHomeVideoListItem) {
    if (!window.confirm('发布后，这条视频会替换小程序首页当前展示的视频。确认发布吗？')) return
    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      await publishAdminHomeVideo(item.id, item.version)
      setNotice('已发布，首页当前视频已更新。')
      await loadVideos()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function unpublish(item: AdminHomeVideoListItem) {
    if (!window.confirm('下架后，小程序首页将不再展示这条视频。确认下架吗？')) return
    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      await unpublishAdminHomeVideo(item.id, item.version)
      setNotice('视频已下架。')
      await loadVideos()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function remove(item: AdminHomeVideoListItem) {
    if (!window.confirm('确认删除“' + item.title + '”吗？删除后无法恢复。')) return
    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      await deleteAdminHomeVideo(item.id, item.version)
      setNotice('宣传视频已删除。')
      await loadVideos()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusyId('')
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  if (editingId !== undefined) {
    return (
      <HomeVideoEditor
        onChanged={() => void loadVideos()}
        onClose={() => setEditingId(undefined)}
        onDirtyChange={setDirty}
        videoId={editingId ?? undefined}
      />
    )
  }

  return (
    <div className="video-admin-page">
      <div className="page-heading-row video-page-heading">
        <PageIntro
          title="首页宣传视频管理"
          description="维护首页视频与封面；发布新视频时会自动替换当前展示内容。"
        />
        <button className="primary-button" onClick={() => setEditingId(null)} type="button">
          ＋ 新增宣传视频
        </button>
      </div>
      <form className="filter-bar video-filter-bar" onSubmit={handleSearch}>
        <label className="video-search-field">
          <span className="visually-hidden">搜索视频标题</span>
          <span aria-hidden="true" className="video-search-field__icon">⌕</span>
          <input
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="搜索视频标题"
            value={keywordInput}
          />
        </label>
        <label>
          <span className="visually-hidden">视频状态</span>
          <select
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value as '' | HomeVideoStatus)
            }}
            value={status}
          >
            <option value="">全部状态</option>
            <option value="ONLINE">首页展示中</option>
            <option value="DRAFT">草稿</option>
            <option value="OFFLINE">已下架</option>
          </select>
        </label>
        <button className="secondary-button" type="submit">搜索</button>
      </form>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {notice && <p className="notice success-notice">{notice}</p>}
      <div className="table-card video-table-card">
        <div className="video-table-summary">
          <div>
            <strong>视频内容</strong>
            <span>共 {result.total} 条记录</span>
          </div>
          <small>首页同一时间仅展示一条已发布视频</small>
        </div>
        <table role="table">
          <thead>
            <tr>
              <th>视频</th>
              <th>状态</th>
              <th>最近更新</th>
              <th><span className="visually-hidden">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {!loading && result.items.length === 0 && (
              <tr>
                <td className="empty-state" colSpan={4}>
                  暂无宣传视频，点击“新增宣传视频”开始上传。
                </td>
              </tr>
            )}
            {result.items.map((item) => (
              <tr key={item.id}>
                <td data-card-heading="">
                  <div className="video-list-title">
                    <div className="video-list-cover">
                      <MediaPreview alt={item.title} mediaId={item.coverMediaId} />
                    </div>
                    <div>
                      <strong>{item.title}</strong>
                      {item.hasUnpublishedChanges && <small>有尚未发布的修改</small>}
                    </div>
                  </div>
                </td>
                <td data-label="状态">
                  <span className={'status-pill ' + (item.status === 'ONLINE' ? 'active' : 'disabled')}>
                    {statusText[item.status]}
                  </span>
                </td>
                <td data-label="最近更新">{formatTime(item.updatedAt)}</td>
                <td data-card-actions="">
                  <div className="row-actions">
                    <button className="text-button" onClick={() => setEditingId(item.id)} type="button">
                      编辑
                    </button>
                    {item.status === 'ONLINE' ? (
                      <button className="text-button danger" disabled={busyId === item.id} onClick={() => void unpublish(item)} type="button">
                        下架
                      </button>
                    ) : (
                      <button className="text-button" disabled={busyId === item.id} onClick={() => void publish(item)} type="button">
                        发布
                      </button>
                    )}
                    {item.status !== 'ONLINE' && (
                      <button className="text-button danger" disabled={busyId === item.id} onClick={() => void remove(item)} type="button">
                        删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button className="secondary-button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">
          上一页
        </button>
        <span>第 {result.page} 页，共 {result.total} 条</span>
        <button className="secondary-button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} type="button">
          下一页
        </button>
      </div>
    </div>
  )
}
