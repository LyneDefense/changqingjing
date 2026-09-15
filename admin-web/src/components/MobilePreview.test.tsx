import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobilePreview } from './MobilePreview'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('MobilePreview', () => {
  it('leaves desktop markup untouched and follows viewport changes', () => {
    let matches = false
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return matches },
      addEventListener: (_name: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_name: string, listener: () => void) => listeners.delete(listener),
    }))
    const { container, unmount } = render(<MobilePreview><aside>实时预览</aside></MobilePreview>)
    expect(container.firstElementChild?.tagName).toBe('ASIDE')
    expect(container.querySelector('details')).toBeNull()
    act(() => { matches = true; listeners.forEach((listener) => listener()) })
    const details = container.querySelector('details')!
    expect(details.open).toBe(false)
    fireEvent.click(screen.getByText('小程序效果预览'))
    expect(details.open).toBe(true)
    act(() => { matches = false; listeners.forEach((listener) => listener()) })
    expect(container.firstElementChild?.tagName).toBe('ASIDE')
    unmount()
    expect(listeners.size).toBe(0)
  })
})
