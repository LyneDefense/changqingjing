import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue'

interface NavigationLink {
  to: string
  label: string
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
    links: [{ to: '/', label: '工作台', end: true }],
  },
  {
    label: '内容运营',
    links: [
      { to: '/home-videos', label: '首页宣传视频', permission: 'content:read' },
      { to: '/company', label: '公司介绍', permission: 'content:read' },
      { to: '/scenics', label: '景区管理', permission: 'content:read' },
      { to: '/products', label: '会员福利管理', permission: 'content:read' },
    ],
  },
  {
    label: '合作权益',
    links: [
      { to: '/cooperation', label: '收益板块管理', permission: 'content:read' },
      { to: '/cooperation/branch', label: '分公司方案', permission: 'content:read' },
      { to: '/cooperation/membership', label: '会员体系', permission: 'content:read' },
    ],
  },
  {
    label: '系统管理',
    links: [
      { to: '/users', label: '注册用户', permission: 'user:read' },
      { to: '/staff', label: '后台人员', permission: 'staff:manage' },
    ],
  },
]

export function Sidebar() {
  const auth = useAuth()
  return (
    <aside className="sidebar">
      <div className="brand-mark">常</div>
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
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  end={link.end}
                  to={link.to}
                >
                  {link.label}
                </NavLink>
              ))}
            </section>
          )
        })}
      </nav>
    </aside>
  )
}
