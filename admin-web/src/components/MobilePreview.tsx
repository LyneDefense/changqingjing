import type { ReactNode } from 'react'
import { useMobileLayout } from '../hooks/useMobileLayout'

export function MobilePreview({ children }: { children: ReactNode }) {
  const mobile = useMobileLayout()
  if (!mobile) return children

  return (
    <details className="mobile-preview">
      <summary>
        <span>小程序效果预览</span>
        <small className="mobile-preview__hint" aria-hidden="true" />
      </summary>
      <div className="mobile-preview__body">{children}</div>
    </details>
  )
}
