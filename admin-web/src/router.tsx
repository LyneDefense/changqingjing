import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ContentPage } from './pages/ContentPage'
import { DashboardPage } from './pages/DashboardPage'
import { RouteErrorPage } from './pages/RouteErrorPage'
import { UsersPage } from './pages/UsersPage'

export const routes = [
  {
    path: '/',
    Component: App,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, Component: DashboardPage },
      { path: 'users', Component: UsersPage },
      { path: 'content', Component: ContentPage },
    ],
  },
]

export const router = createBrowserRouter(routes, {
  basename: '/admin',
})
