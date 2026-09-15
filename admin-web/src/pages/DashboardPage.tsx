import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminApiError, getAdminDashboard } from '../api/admin'
import type { AdminDashboard, DailyRegistration, RecentRegisteredUser } from '../api/admin'
import { useAuth } from '../auth/authContextValue'
import { AdminIcon } from '../components/AdminIcon'
import { workspaceModules } from '../config/adminModules'
import { auditActorLabel, auditResultLabel, formatAdminTime } from './auditPresentation'
import './DashboardPage.css'

export function DashboardPage() {
  const auth = useAuth()
  const canReadUsers = auth.hasPermission('user:read')
  const visibleModules = workspaceModules.filter((module) => !module.permission || auth.hasPermission(module.permission))
  const owner = `${auth.user?.id}:${auth.user?.role}`
  const [snapshot, setSnapshot] = useState<{ owner: string; data: AdminDashboard }>()
  const data = snapshot?.owner === owner ? snapshot.data : undefined
  const [days, setDays] = useState<7 | 30>(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const id = ++sequence.current
    setLoading(true); setError('')
    try {
      const response = await getAdminDashboard(days)
      if (id === sequence.current) setSnapshot({ owner, data: response })
    } catch (failure) {
      if (id === sequence.current) setError(failure instanceof AdminApiError
        ? `${failure.message}${failure.traceId ? `（追踪号：${failure.traceId}）` : ''}` : '看板数据暂时无法加载，请稍后重试')
    } finally { if (id === sequence.current) setLoading(false) }
  }, [days, owner])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
    // Sequence invalidation deliberately uses the latest counter, not a DOM ref.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    return () => { ++sequence.current }
  }, [load])
  const showUserData = canReadUsers && data?.userMetricsVisible
  const statistics = data?.statistics
  const metrics = [
    { label: '累计注册', value: statistics?.totalRegistrations, note: '首次注册累计 · 含已删除账号', icon: 'users' as const },
    { label: '今日新增', value: statistics?.todayRegistrations, note: '北京时间 00:00 起', icon: 'member' as const },
    { label: '近 7 日新增', value: statistics?.last7DaysRegistrations, note: '包含今天的最近 7 个自然日', icon: 'dashboard' as const },
    { label: '冻结用户', value: statistics?.frozenUsers, note: '当前冻结 · 不含已删除账号', icon: 'staff' as const },
  ]
  return <div className="dashboard-page data-dashboard">
    <header className="data-dashboard__header">
      <div><p>欢迎回来，{auth.user?.displayName || '管理员'}</p><h2>工作台</h2><span>注册动态、操作追溯与内容管理，一处掌握。</span></div>
      <div className="data-dashboard__header-actions"><small>{data ? `更新于 ${formatAdminTime(data.generatedAt)} · 北京时间` : '数据按北京时间统计'}</small><button className="secondary-button" type="button" disabled={loading} onClick={() => void load()}>{loading ? '正在加载…' : '刷新数据'}</button></div>
    </header>
    {error && <p className="notice error-notice" role="alert">{error} <button className="text-button" type="button" onClick={() => void load()}>重新加载</button></p>}
    {canReadUsers && <section className="dashboard-metrics" aria-label="注册数据概览">{metrics.map((metric) => <article className="dashboard-metric" key={metric.label}>
      <div><span>{metric.label}</span><AdminIcon name={metric.icon} /></div><strong>{!error && showUserData && metric.value !== undefined ? new Intl.NumberFormat('zh-CN').format(metric.value) : '—'}</strong><small>{metric.note}</small>
    </article>)}</section>}
    {loading && !data && <p className="dashboard-loading" role="status">正在读取最新看板数据…</p>}
    {!loading && !error && data && canReadUsers && !data.userMetricsVisible && <p className="notice">当前会话无权查看注册数据，请刷新登录状态。</p>}
    {!canReadUsers && <p className="dashboard-scope-note">当前展示自己的最近操作与可管理模块；注册数据仅管理员可查看。</p>}
    {showUserData && !error && <section className="dashboard-panel registration-panel">
      <div className="dashboard-panel__heading"><div><span>用户增长</span><h3>注册趋势</h3></div><div className="dashboard-period" aria-label="注册趋势时间范围">{([7, 30] as const).map((period) => <button key={period} type="button" aria-pressed={days === period} disabled={loading} onClick={() => setDays(period)}>近 {period} 天</button>)}</div></div>
      <RegistrationChart points={data.registrationTrend} />
      <p className="dashboard-chart-note">仅统计首次注册，重复登录不计入新增；已删除账号的历史注册仍计入趋势。</p>
    </section>}
    <div className="dashboard-data-columns">
      {canReadUsers && <section className="dashboard-panel dashboard-recent-users">
        <div className="dashboard-panel__heading"><div><span>新用户动态</span><h3>最近注册</h3></div><Link className="quiet-link" to="/users">查看注册用户 <span aria-hidden="true">›</span></Link></div>
        {showUserData && !error && data.recentUsers.length > 0 ? <div className="dashboard-recent-list">{data.recentUsers.map((user) => <Link className="dashboard-user-row" key={user.id} to={`/users?userId=${encodeURIComponent(user.id)}`}>
          <UserAvatar user={user} /><span className="dashboard-user-row__copy"><strong>{user.displayName || '微信用户'}</strong><small>{user.maskedPhone || '未绑定手机号'}</small></span><span className="dashboard-user-row__meta"><span className={`status-pill ${user.status === 'ACTIVE' ? 'active' : 'disabled'}`}>{user.status === 'ACTIVE' ? '正常' : '已冻结'}</span><small>{formatAdminTime(user.registeredAt)}</small></span>
        </Link>)}</div> : <p className="dashboard-data-empty">{error ? '注册动态暂不可用' : loading ? '正在加载…' : '暂无注册用户'}</p>}
        <p className="dashboard-list-note">最新 10 位未删除用户 · 点击查看脱敏资料</p>
      </section>}
      <section className="dashboard-panel dashboard-recent-audit">
        <div className="dashboard-panel__heading"><div><span>变更动态</span><h3>最近操作</h3></div><Link className="quiet-link" to="/audit-events">全部日志 <span aria-hidden="true">›</span></Link></div>
        {data && !error && data.recentOperations.length > 0 ? <div className="dashboard-recent-list">{data.recentOperations.map((event) => <Link className="dashboard-audit-row" key={event.id} to={`/audit-events?logId=${encodeURIComponent(event.id)}`}>
          <span className={`dashboard-audit-dot ${event.result.toLowerCase()}`} aria-hidden="true" /><span><strong>{event.moduleLabel} · {event.actionLabel}</strong><p>{event.targetName || auditActorLabel(event)}</p><small>{auditActorLabel(event)} · {formatAdminTime(event.createdAt)}</small></span><small className={`dashboard-audit-result ${event.result.toLowerCase()}`}>{auditResultLabel(event)}</small>
        </Link>)}</div> : <p className="dashboard-data-empty">{error ? '操作动态暂不可用' : loading ? '正在加载…' : '暂无操作记录'}</p>}
        <p className="dashboard-list-note">{auth.user?.role === 'ADMIN' ? '最新 6 条操作 · 点击追溯详细变更' : '仅自己的最新 6 条操作'}</p>
      </section>
    </div>
    <section className="dashboard-panel dashboard-quick-manage">
      <div className="dashboard-panel__heading"><div><span>内容中心</span><h3>常用管理</h3></div><Link className="quiet-link" to="/guide">查看完整使用指南 <span aria-hidden="true">›</span></Link></div>
      <div className="dashboard-quick-grid">{visibleModules.map((module) => <Link className="dashboard-quick-item" key={module.to} to={module.to}><span><AdminIcon name={module.icon} /></span><div><strong>{module.workspaceLabel ?? module.label}</strong><small>{module.description}</small></div><i aria-hidden="true">›</i></Link>)}</div>
      <p className="dashboard-list-note">编辑内容 → 保存草稿 → 核对预览 → 确认发布。草稿不会影响线上展示。</p>
    </section>
  </div>
}

function UserAvatar({ user }: { user: RecentRegisteredUser }) {
  const [failed, setFailed] = useState(false)
  return <span className="dashboard-user-avatar">{user.avatarUrl && !failed ? <img src={user.avatarUrl} alt="" onError={() => setFailed(true)} /> : (user.displayName || '微').slice(0, 1)}</span>
}

function RegistrationChart({ points }: { points: DailyRegistration[] }) {
  const [selected, setSelected] = useState<string>()
  const width = 800, height = 200, left = 38, right = 20, top = 14, bottom = 28
  const ceiling = Math.ceil(Math.max(2, ...points.map((point) => point.count)) / 2) * 2
  const position = (index: number, count: number) => ({ x: left + index * (width - left - right) / Math.max(1, points.length - 1), y: height - bottom - count / ceiling * (height - top - bottom) })
  const coords = points.map((point, index) => position(index, point.count))
  const line = coords.map((point) => `${point.x},${point.y}`).join(' ')
  const total = points.reduce((sum, point) => sum + point.count, 0)
  const focusPoint = points.find((point) => point.date === selected)
  const indices = new Set([0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1])
  return <div className="registration-chart">
    <div className="registration-chart__summary"><strong>本期新增 <span>{total}</span> 人</strong><span role="status">{focusPoint ? `${focusPoint.date} · 新增 ${focusPoint.count} 人` : '每日首次注册人数'}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`近 ${points.length} 天首次注册趋势，共新增 ${total} 人`}>
      {[0, ceiling / 2, ceiling].map((value) => { const y = position(0, value).y; return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} className="registration-chart__grid" /><text x={left - 12} y={y + 4} textAnchor="end">{value}</text></g> })}
      {coords.length > 0 && <><polygon points={`${left},${height - bottom} ${line} ${width - right},${height - bottom}`} className="registration-chart__area" /><polyline points={line} className="registration-chart__line" /></>}
      {points.map((point, index) => <g key={point.date}><circle cx={coords[index].x} cy={coords[index].y} r="4" className="registration-chart__point"><title>{point.date}：新增 {point.count} 人</title></circle>{indices.has(index) && <text x={coords[index].x} y={height - 5} textAnchor="middle">{point.date.slice(5).replace('-', '/')}</text>}</g>)}
    </svg>
    <div className="registration-chart__days" aria-label="每日注册详情">{points.map((point) => <button key={point.date} type="button" aria-label={`${point.date}：新增 ${point.count} 人`} onFocus={() => setSelected(point.date)} onMouseEnter={() => setSelected(point.date)} onClick={() => setSelected(point.date)}><span>{point.date.slice(5)}</span><strong>{point.count}</strong></button>)}</div>
  </div>
}
