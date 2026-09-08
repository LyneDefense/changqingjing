import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AdminOnlyRoute, AuthRoot, ProtectedRoute } from './auth/AuthRoutes'
import { ContentPage } from './pages/ContentPage'
import { DashboardPage } from './pages/DashboardPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { LoginPage } from './pages/LoginPage'
import { RouteErrorPage } from './pages/RouteErrorPage'
import { StaffPage } from './pages/StaffPage'
import { UsersPage } from './pages/UsersPage'

export const routes = [
  {
    path: '/',
    Component: AuthRoot,
    ErrorBoundary: RouteErrorPage,
    children: [
      { path: 'login', Component: LoginPage },
      {
        Component: ProtectedRoute,
        children: [
          {
            Component: App,
            children: [
              { index: true, Component: DashboardPage },
              { path: 'content', Component: ContentPage },
              { path: 'forbidden', Component: ForbiddenPage },
              {
                Component: AdminOnlyRoute,
                children: [
                  { path: 'users', Component: UsersPage },
                  { path: 'staff', Component: StaffPage },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes, {
  basename: '/admin',
})
