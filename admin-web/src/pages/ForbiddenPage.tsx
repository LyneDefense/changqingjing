import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <section className="centered-state error-state">
      <p className="status-code">403</p>
      <h2>无权访问此功能</h2>
      <p>当前账号没有所需权限。如需处理，请联系管理员调整角色。</p>
      <Link className="primary-button button-link" to="/">
        返回工作台
      </Link>
    </section>
  )
}
