import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './auth/authContextValue'
import { Sidebar } from './components/Sidebar'

export function App() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const page = pageMeta(location.pathname)

  async function handleLogout() {
    await auth.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <Sidebar />
      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-breadcrumb" aria-label="当前位置">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m4 11 8-7 8 7v9h-6v-5h-4v5H4z" />
            </svg>
            <span>{page.group}</span>
            <i>/</i>
            <strong>{page.title}</strong>
          </div>
          <div className="header-actions">
            <span className="header-divider" />
            <span className="current-user__avatar" aria-hidden="true">
              {auth.user?.displayName?.slice(0, 1) || '常'}
            </span>
            <span className="current-user">
              <strong>{auth.user?.displayName}</strong>
              <small>{auth.user?.role === 'ADMIN' ? '管理员' : '运营人员'}</small>
            </span>
            <button aria-label="退出登录" className="header-logout" onClick={() => void handleLogout()} type="button">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9" />
              </svg>
            </button>
          </div>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

const routeMeta: Record<string, { group: string, title: string }> = {
  '/': { group: '概览', title: '工作台' },
  '/home-hero': { group: '内容运营', title: '首页头图' },
  '/home-videos': { group: '内容运营', title: '首页宣传视频' },
  '/company': { group: '内容运营', title: '公司介绍' },
  '/scenics': { group: '内容运营', title: '景区管理' },
  '/products': { group: '内容运营', title: '会员福利管理' },
  '/cooperation': { group: '合作权益', title: '收益板块管理' },
  '/cooperation/branch': { group: '合作权益', title: '分公司方案' },
  '/cooperation/membership': { group: '合作权益', title: '会员体系' },
  '/users': { group: '系统管理', title: '注册用户' },
  '/staff': { group: '系统管理', title: '后台人员' },
}

function pageMeta(pathname: string) {
  return routeMeta[pathname] ?? { group: '管理中心', title: '页面' }
}
