import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue'
import { adminNavigationGroups } from '../config/adminModules'
import { AdminIcon } from './AdminIcon'

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
        {adminNavigationGroups.map((group) => {
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
