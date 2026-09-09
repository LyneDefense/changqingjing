import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AdminApiError,
  getRegisteredUser,
  searchRegisteredUsers,
} from '../api/admin'
import type {
  AppUserStatus,
  PageResponse,
  RegisteredAppUser,
} from '../api/admin'
import { PageIntro } from '../components/PageIntro'

const emptyPage: PageResponse<RegisteredAppUser> = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
}

function formatTime(value?: string) {
  if (!value) return '尚未登录'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return `${error.message}${error.traceId ? `（追踪号：${error.traceId}）` : ''}`
  }
  return '用户信息加载失败，请稍后重试'
}

export function UsersPage() {
  const [result, setResult] = useState(emptyPage)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'' | AppUserStatus>('')
  const [phoneBound, setPhoneBound] = useState<'' | 'true' | 'false'>('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUser, setSelectedUser] = useState<RegisteredAppUser>()
  const [detailLoading, setDetailLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await searchRegisteredUsers({ keyword, status, phoneBound, page }))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [keyword, page, phoneBound, status])

  useEffect(() => {
    // Query state is the synchronization target for this request.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadUsers()
  }, [loadUsers])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  async function openDetail(user: RegisteredAppUser) {
    setSelectedUser(user)
    setDetailLoading(true)
    setError('')
    try {
      setSelectedUser(await getRegisteredUser(user.id))
    } catch (requestError) {
      setSelectedUser(undefined)
      setError(errorText(requestError))
    } finally {
      setDetailLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  return (
    <>
      <PageIntro
        title="注册用户"
        description="查看已通过微信手机号完成注册的用户。这里只展示账号状态与脱敏资料，不包含余额、等级或营销操作。"
      />

      <form className="filter-bar" onSubmit={submitSearch}>
        <label>
          <span className="visually-hidden">搜索用户</span>
          <input
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="搜索昵称、用户编号或脱敏手机号"
            value={keywordInput}
          />
        </label>
        <label>
          <span className="visually-hidden">用户状态</span>
          <select
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value as '' | AppUserStatus)
            }}
            value={status}
          >
            <option value="">全部状态</option>
            <option value="ACTIVE">正常</option>
            <option value="DISABLED">不可用</option>
          </select>
        </label>
        <label>
          <span className="visually-hidden">手机号绑定状态</span>
          <select
            onChange={(event) => {
              setPage(1)
              setPhoneBound(event.target.value as '' | 'true' | 'false')
            }}
            value={phoneBound}
          >
            <option value="">全部绑定状态</option>
            <option value="true">已绑定手机号</option>
            <option value="false">未绑定手机号</option>
          </select>
        </label>
        <button className="secondary-button" type="submit">搜索</button>
      </form>

      {error && <p className="notice error-notice" role="alert">{error}</p>}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>手机号</th>
              <th>状态</th>
              <th>注册时间</th>
              <th>最近登录</th>
              <th><span className="visually-hidden">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.displayName || '微信用户'}</strong>
                  <small>用户编号：{user.id}</small>
                </td>
                <td>{user.phoneBound ? user.maskedPhone : '未绑定'}</td>
                <td>
                  <span className={`status-pill ${user.status.toLowerCase()}`}>
                    {user.status === 'ACTIVE' ? '正常' : '不可用'}
                  </span>
                </td>
                <td>{formatTime(user.registeredAt)}</td>
                <td>{formatTime(user.lastLoginAt)}</td>
                <td>
                  <div className="row-actions">
                    <button className="text-button" onClick={() => void openDetail(user)} type="button">
                      查看详情
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="empty-state">正在加载注册用户…</p>}
        {!loading && result.items.length === 0 && (
          <p className="empty-state">没有符合条件的注册用户。</p>
        )}
      </div>

      <div className="pagination" aria-label="注册用户列表分页">
        <button
          className="secondary-button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((current) => current - 1)}
          type="button"
        >上一页</button>
        <span>第 {result.page} / {totalPages} 页，共 {result.total} 位用户</span>
        <button
          className="secondary-button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((current) => current + 1)}
          type="button"
        >下一页</button>
      </div>

      {selectedUser && (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="user-detail-title" aria-modal="true" className="modal-card" role="dialog">
            <div className="modal-header">
              <h2 id="user-detail-title">注册用户详情</h2>
              <button aria-label="关闭" className="icon-button" onClick={() => setSelectedUser(undefined)} type="button">×</button>
            </div>
            {detailLoading ? (
              <p className="empty-state">正在加载详情…</p>
            ) : (
              <dl className="detail-list">
                <div><dt>显示昵称</dt><dd>{selectedUser.displayName || '微信用户'}</dd></div>
                <div><dt>用户编号</dt><dd className="breakable-value">{selectedUser.id}</dd></div>
                <div><dt>手机号</dt><dd>{selectedUser.phoneBound ? selectedUser.maskedPhone : '未绑定'}</dd></div>
                <div><dt>微信身份</dt><dd>{selectedUser.wechatBound ? '已绑定' : '未绑定'}</dd></div>
                <div><dt>账号状态</dt><dd>{selectedUser.status === 'ACTIVE' ? '正常' : '不可用'}</dd></div>
                <div><dt>注册时间</dt><dd>{formatTime(selectedUser.registeredAt)}</dd></div>
                <div><dt>最近登录</dt><dd>{formatTime(selectedUser.lastLoginAt)}</dd></div>
              </dl>
            )}
          </section>
        </div>
      )}
    </>
  )
}
