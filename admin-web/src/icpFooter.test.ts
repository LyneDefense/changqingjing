import { describe, expect, it } from 'vitest'
import source from '../index.html?raw'

describe('ICP filing footer', () => {
  it('is present in the public HTML without requiring JavaScript or login', () => {
    const document = new DOMParser().parseFromString(source, 'text/html')
    const footer = document.querySelector<HTMLElement>('footer')!
    const link = footer.querySelector('a')!

    expect(link.textContent).toBe('鄂ICP备2025140094号-3')
    expect(link.getAttribute('href')).toBe('https://beian.miit.gov.cn/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(footer.parentElement).toBe(document.body)
    expect(document.documentElement.lang).toBe('zh-CN')
  })
})
