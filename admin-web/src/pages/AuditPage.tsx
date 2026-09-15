import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminApiError, getAuditEvent, searchAuditEvents } from '../api/admin'
import type { AuditEvent, AuditFilters, PageResponse } from '../api/admin'
import { useAuth } from '../auth/authContextValue'
import { PageIntro } from '../components/PageIntro'
import { auditActorLabel, auditResultLabel, formatAdminTime } from './auditPresentation'
import './AuditPage.css'

const modules = {
  AUTH: '登录与会话', HOME_HERO: '首页头图', HOME_VIDEO: '宣传视频', COMPANY: '公司介绍',
  SCENIC: '景区管理', PRODUCT: '会员福利', COOPERATION: '合作权益', MEDIA: '媒体上传',
  MAP: '地图选点', USERS: '注册用户', STAFF: '后台人员', OTHER: '其他操作',
}
const actions = {
  DRAFT_SAVE: '保存草稿', PUBLISH: '发布', UNPUBLISH: '下架', PREVIEW: '预览草稿',
  DELETE: '删除', LOGIN: '登录', LOGOUT: '退出登录', CREATE: '新增', UPDATE: '修改 / 冻结 / 解冻',
  PASSWORD_RESET: '重置密码', UPLOAD: '媒体上传',
}
const empty: PageResponse<AuditEvent> = { items: [], page: 1, pageSize: 20, total: 0 }
function errorMessage(error: unknown) {
  return error instanceof AdminApiError ? `${error.message}${error.traceId ? `（追踪号：${error.traceId}）` : ''}` : '日志加载失败，请稍后重试'
}

export function AuditPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [input, setInput] = useState<AuditFilters>({})
  const [filters, setFilters] = useState<AuditFilters>({})
  const [page, setPage] = useState(1)
  const [data, setData] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AuditEvent>()
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const requestId = useRef(0)
  const detailId = useRef(0)
  const selectedId = params.get('logId')

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true); setError('')
    try {
      const response = await searchAuditEvents({ ...filters, page, pageSize: 20 })
      if (id !== requestId.current) return
      const last = Math.max(1, Math.ceil(response.total / response.pageSize))
      if (page > last) setPage(last)
      else setData(response)
    } catch (failure) { if (id === requestId.current) setError(errorMessage(failure)) }
    finally { if (id === requestId.current) setLoading(false) }
  }, [filters, page])

  useEffect(() => {
    // Synchronize the submitted filters with the server, not individual keystrokes.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
    // This is a sequence counter, not a DOM ref; invalidation intentionally uses the latest value.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    return () => { ++requestId.current }
  }, [load])

  useEffect(() => {
    if (!selectedId) return
    const id = ++detailId.current
    // The URL is also used by recent operations on the dashboard.
    // oxlint-disable-next-line react/set-state-in-effect
    setDetailLoading(true)
    setDetailError('')
    void getAuditEvent(selectedId).then((event) => { if (id === detailId.current) setSelected(event) })
      .catch((failure) => { if (id === detailId.current) setDetailError(errorMessage(failure)) })
      .finally(() => { if (id === detailId.current) setDetailLoading(false) })
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    return () => { ++detailId.current }
  }, [selectedId])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (input.from && input.to && input.from > input.to) { setError('开始日期不能晚于结束日期'); return }
    setPage(1); setFilters({ ...input, actor: input.actor?.trim(), keyword: input.keyword?.trim() })
  }
  function change(key: keyof AuditFilters, value: string) { setInput((current) => ({ ...current, [key]: value })) }
  function close() {
    ++detailId.current; setSelected(undefined); setDetailError(''); setDetailLoading(false)
    setParams((current) => { current.delete('logId'); return current }, { replace: true })
  }

  return <div className="audit-page">
    <PageIntro title="操作日志" description="留存每一次提交、发布与账号操作，追溯变更来源。时间统一为北京时间。" />
    <div className="audit-context-note">
      <span>{user?.role === 'ADMIN' ? '查看全部账号的操作记录' : '仅查看自己的操作记录'}</span>
      <small>只读记录 · 保存草稿不等于发布 · IP 和登录会话仅供辅助追溯</small>
    </div>
    <form className="audit-filters" onSubmit={submit}>
      <label>开始日期<input type="date" value={input.from || ''} onChange={(e) => change('from', e.target.value)} /></label>
      <label>结束日期<input type="date" value={input.to || ''} onChange={(e) => change('to', e.target.value)} /></label>
      <label>操作账号<input maxLength={100} placeholder="账号 / 显示名称" value={input.actor || ''} onChange={(e) => change('actor', e.target.value)} /></label>
      <label>业务模块<select value={input.module || ''} onChange={(e) => change('module', e.target.value)}><option value="">全部模块</option>{Object.entries(modules).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label>操作类型<select value={input.action || ''} onChange={(e) => change('action', e.target.value)}><option value="">全部操作</option>{Object.entries(actions).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label>操作结果<select value={input.result || ''} onChange={(e) => change('result', e.target.value)}><option value="">全部结果</option><option value="SUCCESS">成功</option><option value="FAILURE">失败</option></select></label>
      <label className="audit-filters__keyword">内容 / 来源 IP<input maxLength={100} placeholder="搜索内容名称或 IP" value={input.keyword || ''} onChange={(e) => change('keyword', e.target.value)} /></label>
      <div className="audit-filters__actions"><button type="submit" className="primary-button" disabled={loading}>查询</button><button type="button" className="secondary-button" onClick={() => { setInput({}); setFilters({}); setPage(1) }}>重置</button></div>
    </form>
    {error && <p className="notice error-notice" role="alert">{error} <button type="button" className="text-button" onClick={() => void load()}>重试</button></p>}
    <div className="table-card audit-table">
      <div className="audit-table__heading"><strong>操作记录 <small>共 {data.total} 条</small></strong><button className="text-button" type="button" disabled={loading} onClick={() => void load()}>刷新</button></div>
      <table role="table"><thead><tr><th>时间 / 账号</th><th>操作 / 内容</th><th>结果</th><th>来源</th><th><span className="visually-hidden">详情</span></th></tr></thead>
        <tbody>{!error && data.items.map((event) => <tr key={event.id}>
          <td data-card-heading=""><strong>{auditActorLabel(event)}</strong><small>{event.actorLoginName || '未记录账号'}</small><small>{formatAdminTime(event.createdAt)}</small></td>
          <td data-label="操作"><strong>{event.moduleLabel} · {event.actionLabel}</strong><small>{event.targetName || '未记录内容名称'}</small></td>
          <td data-label="结果"><span className={`status-pill ${event.result === 'SUCCESS' ? 'active' : 'disabled'}`}>{auditResultLabel(event)}</span></td>
          <td data-label="来源"><span>{event.clientIp || 'IP 未记录'}</span><small>{event.clientSummary}</small></td>
          <td data-card-actions=""><button type="button" className="text-button" disabled={loading} onClick={() => { setSelected(event); setParams({ logId: event.id }) }}>查看详情</button></td>
        </tr>)}</tbody>
      </table>
      {loading && <p className="empty-state" role="status">正在加载操作日志…</p>}
      {!loading && !error && data.items.length === 0 && <p className="empty-state">没有符合条件的操作记录。</p>}
    </div>
    <div className="pagination" aria-label="操作日志分页"><button className="secondary-button" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>上一页</button><span>第 {data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))} 页</span><button type="button" className="secondary-button" disabled={page >= Math.ceil(data.total / data.pageSize) || loading} onClick={() => setPage((value) => value + 1)}>下一页</button></div>
    {selectedId && <AuditDrawer event={selected} loading={detailLoading} error={detailError} onClose={close} />}
  </div>
}

function AuditDrawer({ event, loading, error, onClose }: { event?: AuditEvent; loading: boolean; error: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    return () => { document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <div className="audit-drawer-backdrop" onClick={onClose} role="presentation">
    <section className="audit-drawer" aria-modal="true" aria-labelledby="audit-detail-title" role="dialog" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') { e.preventDefault(); closeButton.current?.focus() }
    }}>
      <div className="modal-header"><h2 id="audit-detail-title">操作详情</h2><button type="button" className="icon-button" aria-label="关闭操作详情" ref={closeButton} onClick={onClose}>×</button></div>
      {loading && <p className="empty-state" role="status">正在加载详情…</p>}
      {error && <p className="notice error-notice" role="alert">{error}</p>}
      {!loading && !error && event && <>
        <div className="audit-detail-summary"><span>{event.moduleLabel}</span><h3>{event.actionLabel}</h3><p>{event.targetName || '未记录内容名称'}</p><span className={`status-pill ${event.result === 'SUCCESS' ? 'active' : 'disabled'}`}>{auditResultLabel(event)}</span></div>
        <h3 className="audit-detail-subtitle">变更摘要</h3>
        <ul className="audit-changes">{(event.changeSummary.length ? event.changeSummary : ['旧记录未保存变更摘要']).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        <dl className="detail-list">
          <div><dt>操作账号</dt><dd>{auditActorLabel(event)}{event.actorLoginName && <small>{event.actorLoginName}</small>}</dd></div>
          <div><dt>操作时间</dt><dd>{formatAdminTime(event.createdAt)}（北京时间）</dd></div>
          <div><dt>来源 IP</dt><dd>{event.clientIp || '未记录'}</dd></div>
          <div><dt>浏览器 / 系统</dt><dd>{event.clientSummary}</dd></div>
          <div><dt>登录会话</dt><dd className="breakable-value">{event.loginBatchId || '未记录'}</dd></div>
          <div><dt>内容编号</dt><dd className="breakable-value">{event.targetId || '未记录'}</dd></div>
          <div><dt>追踪号</dt><dd className="breakable-value">{event.traceId}</dd></div>
          {event.failureCode && <div><dt>失败原因编号</dt><dd>{event.failureCode}</dd></div>}
        </dl>
        <p className="audit-detail-footnote">{event.historical ? '旧记录中的账号名称可能来自当前账号资料；未保存的 IP、会话与变更信息无法补回。' : 'IP、浏览器与登录会话不能证明实际操作者身份。同一办公网络可能共用 IP。'}</p>
      </>}
    </section>
  </div>
}
