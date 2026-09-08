import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import { AdminApiError } from '../api/admin'
import { useAuth } from '../auth/authContextValue'

interface LoginLocationState {
  from?: string
}

export function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (auth.status === 'authenticated') {
    return <Navigate replace to="/" />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitting(true)
    try {
      await auth.login(loginName, password)
      const state = location.state as LoginLocationState | null
      navigate(state?.from ?? '/', { replace: true })
    } catch (error) {
      setErrorMessage(
        error instanceof AdminApiError ? error.message : '登录失败，请稍后重试',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">常</div>
        <p className="eyebrow">常清净文旅投</p>
        <h1 id="login-title">登录内容管理后台</h1>
        <p className="login-description">使用管理员为你创建的后台账号登录。</p>
        {auth.sessionExpired && (
          <p className="notice error-notice" role="alert">
            登录状态已失效，请重新登录。
          </p>
        )}
        {errorMessage && (
          <p className="notice error-notice" role="alert">
            {errorMessage}
          </p>
        )}
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            登录账号
            <input
              autoComplete="username"
              autoFocus
              maxLength={100}
              onChange={(event) => setLoginName(event.target.value)}
              required
              value={loginName}
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              maxLength={128}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? '正在登录…' : '登录'}
          </button>
        </form>
      </section>
    </main>
  )
}
