import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue'
import { AdminIcon } from '../components/AdminIcon'
import { workspaceModules } from '../config/adminModules'

export function DashboardPage() {
  const auth = useAuth()
  const visibleModules = workspaceModules.filter(
    (module) => !module.permission || auth.hasPermission(module.permission),
  )
  const today = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())

  return (
    <div className="dashboard-page">
      <section className="workspace-hero">
        <div className="workspace-hero__copy">
          <p className="workspace-hero__eyebrow">欢迎回来，{auth.user?.displayName || '管理员'}</p>
          <h2>工作台</h2>
          <p>在这里维护小程序内容，并检查每个板块的发布状态。</p>
          <div className="workspace-hero__actions">
            {visibleModules[0] && <Link className="primary-button button-link" to={visibleModules[0].to}>开始管理内容</Link>}
            {auth.hasPermission('user:read') && <Link className="quiet-link" to="/users">查看注册用户</Link>}
          </div>
        </div>
        <div className="workspace-hero__landscape" aria-hidden="true">
          <span className="workspace-hero__sun" />
          <span className="workspace-hero__mountain workspace-hero__mountain--back" />
          <span className="workspace-hero__mountain workspace-hero__mountain--front" />
          <span className="workspace-hero__date">{today}</span>
        </div>
      </section>

      <div className="dashboard-layout">
        <section className="dashboard-panel dashboard-panel--modules">
          <div className="dashboard-panel__heading">
            <div>
              <span>内容中心</span>
              <h3>常用管理</h3>
            </div>
            <p>按业务模块进入对应的编辑与发布页面</p>
          </div>
          <div className="dashboard-module-list">
            {visibleModules.map((module) => (
              <Link className="dashboard-module" key={module.to} to={module.to}>
                <span className="dashboard-module__icon"><AdminIcon name={module.icon} /></span>
                <span className="dashboard-module__copy">
                  <strong>{module.workspaceLabel ?? module.label}</strong>
                  <small>{module.description}</small>
                </span>
                <span className="dashboard-module__arrow" aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="dashboard-side">
          <section className="dashboard-panel workflow-panel">
            <div className="dashboard-panel__heading">
              <div>
                <span>操作指引</span>
                <h3>内容发布流程</h3>
              </div>
            </div>
            <ol className="workflow-list">
              <li><i>01</i><div><strong>编辑内容</strong><span>进入对应模块完成资料维护</span></div></li>
              <li><i>02</i><div><strong>保存草稿</strong><span>检查图片与文字是否完整</span></div></li>
              <li><i>03</i><div><strong>确认发布</strong><span>发布后小程序端立即更新</span></div></li>
            </ol>
            <Link className="quiet-link workflow-guide-link" to="/guide">查看完整使用指南 <span aria-hidden="true">›</span></Link>
          </section>

          <section className="dashboard-note">
            <span className="dashboard-note__seal">净</span>
            <div>
              <strong>发布前请仔细核对</strong>
              <p>草稿不会影响线上内容，确认无误后再执行发布。</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
