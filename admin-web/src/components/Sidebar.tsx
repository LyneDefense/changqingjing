import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue'
import { AdminIcon } from './AdminIcon'
import type { AdminIconName } from './AdminIcon'

interface NavigationLink {
  to: string
  label: string
  icon: AdminIconName
  end?: boolean
  permission?: string
}

interface NavigationGroup {
  label: string
  links: NavigationLink[]
}

const groups: NavigationGroup[] = [
  {
    label: '概览',
    links: [{ to: '/', label: '工作台', icon: 'dashboard', end: true }],
  },
  {
    label: '内容运营',
    links: [
      { to: '/home-hero', label: '首页头图', icon: 'hero', permission: 'content:read' },
      { to: '/home-videos', label: '首页宣传视频', icon: 'video', permission: 'content:read' },
      { to: '/company', label: '公司介绍', icon: 'company', permission: 'content:read' },
      { to: '/scenics', label: '景区管理', icon: 'scenic', permission: 'content:read' },
      { to: '/products', label: '会员福利管理', icon: 'gift', permission: 'content:read' },
    ],
  },
  {
    label: '合作权益',
    links: [
      { to: '/cooperation', label: '收益板块管理', icon: 'cooperation', permission: 'content:read' },
      { to: '/cooperation/branch', label: '分公司方案', icon: 'branch', permission: 'content:read' },
      { to: '/cooperation/membership', label: '会员体系', icon: 'member', permission: 'content:read' },
    ],
  },
  {
    label: '系统管理',
    links: [
      { to: '/users', label: '注册用户', icon: 'users', permission: 'user:read' },
      { to: '/staff', label: '后台人员', icon: 'staff', permission: 'staff:manage' },
    ],
  },
]

export function Sidebar() {
  const auth = useAuth()
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <svg aria-hidden="true" className="sidebar-brand__mark" viewBox="0 0 48 48">
          <path d="M4 33 16.5 17l7 8.5L31 15l13 18c-7-2.7-12-1.8-17.4 2-6.6 4.6-13.3 5-22.6-2Z" />
          <path d="M9 37c7.4 2 13 1.1 18.2-2.5 5-3.4 9.6-4.2 16.8-1.5" />
        </svg>
        <div className="sidebar-brand__copy">
          <strong>常清净文旅投</strong>
          <span>管理中心</span>
        </div>
      </div>
      <nav aria-label="管理后台主导航">
        {groups.map((group) => {
          const visibleLinks = group.links.filter(
            (link) => !link.permission || auth.hasPermission(link.permission),
          )
          if (visibleLinks.length === 0) return null
          return (
            <section className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {visibleLinks.map((link) => (
                <NavLink
                  key={link.to}
                  aria-label={link.label}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  end={link.end}
                  title={link.label}
                  to={link.to}
                >
                  <AdminIcon className="nav-link__icon" name={link.icon} />
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </section>
          )
        })}
      </nav>
      <div className="sidebar-signature" aria-hidden="true">
        <span>山水有意</span>
        <span>生活亦可清净</span>
      </div>
    </aside>
  )
}
