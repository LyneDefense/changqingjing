import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue'

const links = [
  { to: '/', label: '工作台', end: true },
  { to: '/content', label: '内容管理', permission: 'content:read' },
  { to: '/users', label: '用户管理', permission: 'user:read' },
  { to: '/staff', label: '人员管理', permission: 'staff:manage' },
]

export function Sidebar() {
  const auth = useAuth()
  return (
    <aside className="sidebar">
      <div className="brand-mark">常</div>
      <nav aria-label="管理后台主导航">
        {links.filter((link) => !link.permission || auth.hasPermission(link.permission)).map((link) => (
          <NavLink
            key={link.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            end={link.end}
            to={link.to}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
