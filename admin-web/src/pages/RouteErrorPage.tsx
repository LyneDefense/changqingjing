import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

export function RouteErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : '页面暂时无法加载'

  return (
    <main className="route-error">
      <h1>出现错误</h1>
      <p>{message}</p>
      <a href="/admin/">返回工作台</a>
    </main>
  )
}
