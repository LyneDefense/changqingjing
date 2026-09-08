import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  AdminApiError,
  createAdminStaff,
  resetAdminStaffPassword,
  searchAdminStaff,
  updateAdminStaff,
} from '../api/admin'
import type {
  AdminRole,
  AdminStaff,
  AdminStatus,
  CreateAdminStaffInput,
  PageResponse,
  UpdateAdminStaffInput,
} from '../api/admin'
import { PageIntro } from '../components/PageIntro'

type EditorState =
  | { kind: 'create' }
  | { kind: 'edit'; staff: AdminStaff }
  | { kind: 'password'; staff: AdminStaff }

const emptyPage: PageResponse<AdminStaff> = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
}

function errorText(error: unknown) {
  if (error instanceof AdminApiError) {
    return `${error.message}${error.traceId ? `（追踪号：${error.traceId}）` : ''}`
  }
  return '操作失败，请稍后重试'
}

function formatTime(value?: string) {
  if (!value) return '尚未登录'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function StaffPage() {
  const [result, setResult] = useState(emptyPage)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'' | AdminStatus>('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<EditorState>()

  const loadStaff = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await searchAdminStaff({ keyword, status, page }))
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }, [keyword, page, status])

  useEffect(() => {
    // Query changes are the effect's synchronization target.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadStaff()
  }, [loadStaff])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  async function toggleStatus(staff: AdminStaff) {
    const nextStatus: AdminStatus = staff.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    const action = nextStatus === 'ACTIVE' ? '启用' : '停用'
    if (!window.confirm(`确认${action}“${staff.displayName}”吗？其现有会话将失效。`)) {
      return
    }
    setError('')
    try {
      await updateAdminStaff(staff.id, {
        displayName: staff.displayName,
        role: staff.role,
        status: nextStatus,
        expectedVersion: staff.version,
      })
      await loadStaff()
    } catch (requestError) {
      setError(errorText(requestError))
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  return (
    <>
      <div className="page-heading-row">
        <PageIntro
          title="人员管理"
          description="创建后台账号、分配角色并管理账号状态。角色或凭据变化后旧会话会立即失效。"
        />
        <button className="primary-button" onClick={() => setEditor({ kind: 'create' })} type="button">
          新增人员
        </button>
      </div>

      <form className="filter-bar" onSubmit={handleSearch}>
        <label>
          <span className="visually-hidden">搜索账号或姓名</span>
          <input
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="搜索账号或姓名"
            value={keywordInput}
          />
        </label>
        <label>
          <span className="visually-hidden">账号状态</span>
          <select
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value as '' | AdminStatus)
            }}
            value={status}
          >
            <option value="">全部状态</option>
            <option value="ACTIVE">已启用</option>
            <option value="DISABLED">已停用</option>
          </select>
        </label>
        <button className="secondary-button" type="submit">搜索</button>
      </form>

      {error && <p className="notice error-notice" role="alert">{error}</p>}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>人员</th>
              <th>角色</th>
              <th>状态</th>
              <th>最近登录</th>
              <th><span className="visually-hidden">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((staff) => (
              <tr key={staff.id}>
                <td>
                  <strong>{staff.displayName}</strong>
                  <small>{staff.loginName}</small>
                </td>
                <td>{staff.role === 'ADMIN' ? '管理员' : '运营'}</td>
                <td>
                  <span className={`status-pill ${staff.status.toLowerCase()}`}>
                    {staff.status === 'ACTIVE' ? '已启用' : '已停用'}
                  </span>
                </td>
                <td>{formatTime(staff.lastLoginAt)}</td>
                <td>
                  <div className="row-actions">
                    <button className="text-button" onClick={() => setEditor({ kind: 'edit', staff })} type="button">编辑</button>
                    <button className="text-button" onClick={() => setEditor({ kind: 'password', staff })} type="button">重置密码</button>
                    <button className="text-button danger" onClick={() => void toggleStatus(staff)} type="button">
                      {staff.status === 'ACTIVE' ? '停用' : '启用'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && result.items.length === 0 && (
          <p className="empty-state">没有符合条件的后台人员。</p>
        )}
        {loading && <p className="empty-state">正在加载人员…</p>}
      </div>

      <div className="pagination" aria-label="人员列表分页">
        <button
          className="secondary-button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((current) => current - 1)}
          type="button"
        >
          上一页
        </button>
        <span>第 {result.page} / {totalPages} 页，共 {result.total} 人</span>
        <button
          className="secondary-button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((current) => current + 1)}
          type="button"
        >
          下一页
        </button>
      </div>

      {editor?.kind === 'create' && (
        <StaffEditor
          onClose={() => setEditor(undefined)}
          onSaved={async () => {
            setEditor(undefined)
            setPage(1)
            await loadStaff()
          }}
        />
      )}
      {editor?.kind === 'edit' && (
        <StaffEditor
          onClose={() => setEditor(undefined)}
          onSaved={async () => {
            setEditor(undefined)
            await loadStaff()
          }}
          staff={editor.staff}
        />
      )}
      {editor?.kind === 'password' && (
        <PasswordEditor
          onClose={() => setEditor(undefined)}
          onSaved={async () => {
            setEditor(undefined)
            await loadStaff()
          }}
          staff={editor.staff}
        />
      )}
    </>
  )
}

function StaffEditor({
  staff,
  onClose,
  onSaved,
}: {
  staff?: AdminStaff
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [loginName, setLoginName] = useState('')
  const [displayName, setDisplayName] = useState(staff?.displayName ?? '')
  const [role, setRole] = useState<AdminRole>(staff?.role ?? 'OPERATOR')
  const [status, setStatus] = useState<AdminStatus>(staff?.status ?? 'ACTIVE')
  const [initialPassword, setInitialPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (staff) {
        const input: UpdateAdminStaffInput = {
          displayName,
          role,
          status,
          expectedVersion: staff.version,
        }
        await updateAdminStaff(staff.id, input)
      } else {
        const input: CreateAdminStaffInput = {
          loginName,
          displayName,
          role,
          initialPassword,
        }
        await createAdminStaff(input)
      }
      await onSaved()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={staff ? '编辑人员' : '新增人员'} onClose={onClose}>
      {error && <p className="notice error-notice" role="alert">{error}</p>}
      <form className="form-stack" onSubmit={submit}>
        {!staff && (
          <label>
            登录账号
            <input
              autoComplete="off"
              maxLength={100}
              minLength={3}
              onChange={(event) => setLoginName(event.target.value)}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,99}"
              required
              value={loginName}
            />
          </label>
        )}
        <label>
          显示姓名
          <input maxLength={100} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
        </label>
        <label>
          角色
          <select onChange={(event) => setRole(event.target.value as AdminRole)} value={role}>
            <option value="OPERATOR">运营</option>
            <option value="ADMIN">管理员</option>
          </select>
        </label>
        {staff && (
          <label>
            状态
            <select onChange={(event) => setStatus(event.target.value as AdminStatus)} value={status}>
              <option value="ACTIVE">已启用</option>
              <option value="DISABLED">已停用</option>
            </select>
          </label>
        )}
        {!staff && (
          <label>
            初始密码
            <input
              autoComplete="new-password"
              maxLength={128}
              minLength={12}
              onChange={(event) => setInitialPassword(event.target.value)}
              required
              type="password"
              value={initialPassword}
            />
            <small className="field-help">至少 12 位，且包含大写、小写字母和数字。</small>
          </label>
        )}
        <ModalActions onClose={onClose} submitting={submitting} />
      </form>
    </Modal>
  )
}

function PasswordEditor({
  staff,
  onClose,
  onSaved,
}: {
  staff: AdminStaff
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) {
      setError('两次输入的密码不一致')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await resetAdminStaffPassword(staff.id, password, staff.version)
      await onSaved()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`重置“${staff.displayName}”的密码`} onClose={onClose}>
      <p className="modal-description">保存后，该人员的全部旧会话都会失效。</p>
      {error && <p className="notice error-notice" role="alert">{error}</p>}
      <form className="form-stack" onSubmit={submit}>
        <label>
          新密码
          <input autoComplete="new-password" minLength={12} maxLength={128} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        </label>
        <label>
          再次输入新密码
          <input autoComplete="new-password" minLength={12} maxLength={128} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
        </label>
        <small className="field-help">至少 12 位，且包含大写、小写字母和数字。</small>
        <ModalActions onClose={onClose} submitting={submitting} />
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="modal-title" aria-modal="true" className="modal-card" role="dialog">
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button aria-label="关闭" className="icon-button" onClick={onClose} type="button">×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

function ModalActions({ onClose, submitting }: { onClose: () => void; submitting: boolean }) {
  return (
    <div className="modal-actions">
      <button className="secondary-button" disabled={submitting} onClick={onClose} type="button">取消</button>
      <button className="primary-button" disabled={submitting} type="submit">{submitting ? '正在保存…' : '保存'}</button>
    </div>
  )
}
