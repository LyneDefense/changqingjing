import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AdminApiError,
  getRegisteredUser,
  searchRegisteredUsers,
  updateRegisteredUserStatus,
  deleteRegisteredUser,
} from '../api/admin'
import type {
  AppUserStatus,
  PageResponse,
  RegisteredAppUser,
} from '../api/admin'
import { PageIntro } from '../components/PageIntro'
import { useAuth } from '../auth/authContextValue'

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
  return '操作失败，请稍后重试'
}

export function UsersPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('user:manage')
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
  const [action, setAction] = useState<{ kind: 'freeze' | 'unfreeze' | 'delete'; user: RegisteredAppUser }>()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const listRequest = useRef(0)
  const detailRequest = useRef(0)
  const actionInFlight = useRef(false)

  const loadUsers = useCallback(async () => {
    const requestId = ++listRequest.current
    setLoading(true)
    setError('')
    try {
      const response = await searchRegisteredUsers({ keyword, status, phoneBound, page })
      if (requestId !== listRequest.current) return
      const lastPage = Math.max(1, Math.ceil(response.total / response.pageSize))
      if (page > lastPage) {
        setPage(lastPage)
      } else {
        setResult(response)
      }
    } catch (requestError) {
      if (requestId === listRequest.current) setError(errorText(requestError))
    } finally {
      if (requestId === listRequest.current) setLoading(false)
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
    const requestId = ++detailRequest.current
    setSelectedUser(user)
    setDetailLoading(true)
    setError('')
    try {
      const detail = await getRegisteredUser(user.id)
      if (requestId === detailRequest.current) setSelectedUser(detail)
    } catch (requestError) {
      if (requestId === detailRequest.current) {
        setSelectedUser(undefined)
        setError(errorText(requestError))
      }
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false)
    }
  }

  function closeDetail() {
    ++detailRequest.current
    setSelectedUser(undefined)
  }

  function prepareAction(kind: 'freeze' | 'unfreeze' | 'delete', user: RegisteredAppUser) {
    closeDetail()
    setActionError('')
    setNotice('')
    setAction({ kind, user })
  }

  async function confirmAction() {
    if (!action || !canManage || actionInFlight.current) return
    actionInFlight.current = true
    setBusy(true)
    setActionError('')
    try {
      if (action.kind === 'delete') {
        await deleteRegisteredUser(action.user)
      } else {
        await updateRegisteredUserStatus(action.user, action.kind === 'freeze' ? 'DISABLED' : 'ACTIVE')
      }
      setNotice(action.kind === 'delete' ? '用户已删除，原有登录已失效。' : action.kind === 'freeze' ? '用户已冻结，原有登录已失效。' : '用户已解冻，需要重新登录。')
      setAction(undefined)
      await loadUsers()
    } catch (requestError) {
      if (requestError instanceof AdminApiError && [404, 409].includes(requestError.status)) {
        setAction(undefined)
        await loadUsers()
        setError(errorText(requestError))
      } else {
        setActionError(errorText(requestError))
      }
    } finally {
      actionInFlight.current = false
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  return (
    <>
      <PageIntro
        title="注册用户"
        description="查询用户脱敏资料，管理账号的冻结、解冻和删除。冻结后无法登录；删除前请核对用户身份。"
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
            <option value="DISABLED">已冻结</option>
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
      {notice && <p className="notice success-notice" role="status">{notice}</p>}

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
                    {user.status === 'ACTIVE' ? '正常' : '已冻结'}
                  </span>
                </td>
                <td>{formatTime(user.registeredAt)}</td>
                <td>{formatTime(user.lastLoginAt)}</td>
                <td>
                  <div className="row-actions">
                    <button className="text-button" disabled={loading || busy} onClick={() => void openDetail(user)} type="button">
                      查看详情
                    </button>
                    {canManage && <>
                      <button className="text-button" disabled={loading || busy} onClick={() => prepareAction(user.status === 'ACTIVE' ? 'freeze' : 'unfreeze', user)} type="button">
                        {user.status === 'ACTIVE' ? '冻结' : '解冻'}
                      </button>
                      <button className="text-button danger" disabled={loading || busy} onClick={() => prepareAction('delete', user)} type="button">删除</button>
                    </>}
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
              <button aria-label="关闭" className="icon-button" onClick={closeDetail} type="button">×</button>
            </div>
            {detailLoading ? (
              <p className="empty-state">正在加载详情…</p>
            ) : (
              <dl className="detail-list">
                <div><dt>显示昵称</dt><dd>{selectedUser.displayName || '微信用户'}</dd></div>
                <div><dt>用户编号</dt><dd className="breakable-value">{selectedUser.id}</dd></div>
                <div><dt>手机号</dt><dd>{selectedUser.phoneBound ? selectedUser.maskedPhone : '未绑定'}</dd></div>
                <div><dt>微信身份</dt><dd>{selectedUser.wechatBound ? '已绑定' : '未绑定'}</dd></div>
                <div><dt>账号状态</dt><dd>{selectedUser.status === 'ACTIVE' ? '正常' : '已冻结'}</dd></div>
                <div><dt>注册时间</dt><dd>{formatTime(selectedUser.registeredAt)}</dd></div>
                <div><dt>最近登录</dt><dd>{formatTime(selectedUser.lastLoginAt)}</dd></div>
              </dl>
            )}
          </section>
        </div>
      )}

      {action && (
        <UserActionDialog
          action={action}
          busy={busy}
          error={actionError}
          onCancel={() => { if (!actionInFlight.current) setAction(undefined) }}
          onConfirm={() => void confirmAction()}
        />
      )}
    </>
  )
}

function UserActionDialog({ action, busy, error, onCancel, onConfirm }: {
  action: { kind: 'freeze' | 'unfreeze' | 'delete'; user: RegisteredAppUser }
  busy: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelButton = useRef<HTMLButtonElement>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLElement>(null)
  const label = action.kind === 'delete' ? '删除' : action.kind === 'freeze' ? '冻结' : '解冻'

  useEffect(() => {
    const previousFocus = document.activeElement
    cancelButton.current?.focus()
    return () => { if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus() }
  }, [])

  useEffect(() => { if (busy) dialog.current?.focus() }, [busy])

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="user-action-title" aria-describedby="user-action-description" aria-modal="true"
        aria-busy={busy} className="modal-card user-action-dialog" role="dialog" ref={dialog} tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) onCancel()
          if (event.key === 'Tab') {
            event.preventDefault()
            if (!busy) {
              const next = document.activeElement === cancelButton.current ? confirmButton.current : cancelButton.current
              next?.focus()
            }
          }
        }}
      >
        <div className="modal-header"><h2 id="user-action-title">{label}注册用户</h2></div>
        <div className="user-action-identity">
          <strong>{action.user.displayName || '微信用户'}</strong>
          <span>{action.user.phoneBound ? action.user.maskedPhone : '未绑定手机号'}</span>
          <small className="breakable-value">用户编号：{action.user.id}</small>
        </div>
        <p className="modal-description" id="user-action-description">
          {action.kind === 'delete'
            ? '将删除用户的昵称、头像关联、手机号和微信绑定，并使所有登录失效。此操作无法撤销；该用户以后仍可重新授权注册。如需禁止登录，请使用冻结。'
            : action.kind === 'freeze'
              ? '冻结后，用户所有登录立即失效，无法重新登录或使用需登录的服务。资料会保留，可以通过解冻恢复使用。'
              : '解冻后，用户可重新登录。此前失效的登录不会恢复，账号资料保持不变。'}
        </p>
        {error && <p className="notice error-notice" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" disabled={busy} onClick={onCancel} ref={cancelButton} type="button">取消</button>
          <button className={action.kind === 'delete' ? 'secondary-button danger-button' : 'primary-button'} disabled={busy} onClick={onConfirm} ref={confirmButton} type="button">
            {busy ? '正在处理…' : `确认${label}`}
          </button>
        </div>
      </section>
    </div>
  )
}
