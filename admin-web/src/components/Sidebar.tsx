import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: '工作台', end: true },
  { to: '/users', label: '用户管理' },
  { to: '/content', label: '内容管理' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand-mark">常</div>
      <nav aria-label="管理后台主导航">
        {links.map((link) => (
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
