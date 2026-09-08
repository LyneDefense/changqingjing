import { Outlet } from 'react-router-dom'
import './App.css'
import { Sidebar } from './components/Sidebar'

export function App() {
  return (
    <div className="admin-shell">
      <Sidebar />
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">常清净文旅投</p>
            <h1>内容管理后台</h1>
          </div>
          <span className="environment-badge">本地环境</span>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
