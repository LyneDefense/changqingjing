import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DashboardPage } from './DashboardPage'

describe('DashboardPage', () => {
  it('shows the initial management modules', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '工作台' })).toBeInTheDocument()
    expect(screen.getByText('注册用户')).toBeInTheDocument()
    expect(screen.getByText('首页宣传视频')).toBeInTheDocument()
    expect(screen.getByText('公司介绍')).toBeInTheDocument()
  })
})
