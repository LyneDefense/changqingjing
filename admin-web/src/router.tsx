import { Navigate, createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AdminOnlyRoute, AuthRoot, ProtectedRoute } from './auth/AuthRoutes'
import { ContentPage } from './pages/ContentPage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { CooperationPage } from './pages/CooperationPage'
import { DashboardPage } from './pages/DashboardPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { HomeVideoPage } from './pages/HomeVideoPage'
import { HomeHeroPage } from './pages/HomeHeroPage'
import { LoginPage } from './pages/LoginPage'
import { ProductPage } from './pages/ProductPage'
import { RouteErrorPage } from './pages/RouteErrorPage'
import { ScenicPage } from './pages/ScenicPage'
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
              { path: 'home-hero', Component: HomeHeroPage },
              { path: 'home-videos', Component: HomeVideoPage },
              { path: 'company', Component: ContentPage },
              { path: 'scenics', Component: ScenicPage },
              { path: 'products', Component: ProductPage },
              { path: 'cooperation', Component: CooperationPage },
              { path: 'cooperation/branch', element: <ComingSoonPage title="分公司方案" /> },
              { path: 'cooperation/membership', element: <ComingSoonPage title="会员体系" /> },
              { path: 'content', element: <Navigate replace to="/company" /> },
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
