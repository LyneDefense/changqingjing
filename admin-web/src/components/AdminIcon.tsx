export type AdminIconName =
  | 'branch'
  | 'company'
  | 'cooperation'
  | 'dashboard'
  | 'gift'
  | 'guide'
  | 'hero'
  | 'member'
  | 'scenic'
  | 'staff'
  | 'users'
  | 'video'

interface AdminIconProps {
  name: AdminIconName
  className?: string
}

export function AdminIcon({ className, name }: AdminIconProps) {
  const common = {
    className,
    'aria-hidden': true,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
    viewBox: '0 0 24 24',
  }

  switch (name) {
    case 'guide':
      return <svg {...common}><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14M6 9h3m-3 4h3m6-4h3m-3 4h3" /></svg>
    case 'dashboard':
      return <svg {...common}><path d="M4 11.2 12 4l8 7.2V20h-6v-5h-4v5H4z" /></svg>
    case 'hero':
      return <svg {...common}><rect height="15" rx="2" width="18" x="3" y="4.5" /><path d="m6 16 4.3-4.4 2.8 2.7 2.4-2.2L19 16M16.8 8.2h.1" /></svg>
    case 'video':
      return <svg {...common}><rect height="14" rx="2" width="18" x="3" y="5" /><path d="m10 9 5 3-5 3z" /></svg>
    case 'company':
      return <svg {...common}><path d="M5 20V8l7-4 7 4v12M9 10h2m2 0h2m-6 4h2m2 0h2M9 20v-3h6v3" /></svg>
    case 'scenic':
      return <svg {...common}><path d="m3 18 5.2-7 3 3.6L15.4 8 21 18zM4 20h16" /></svg>
    case 'gift':
      return <svg {...common}><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7H8.8a2.1 2.1 0 1 1 0-4C11.2 3 12 7 12 7Zm0 0h3.2a2.1 2.1 0 1 0 0-4C12.8 3 12 7 12 7Z" /></svg>
    case 'cooperation':
      return <svg {...common}><path d="m8.2 12.2 2.2 2.2a2.2 2.2 0 0 0 3.1 0l4.1-4.1M10.7 9.6l1.8-1.8a2.2 2.2 0 0 1 3.1 0l3.6 3.6a2.2 2.2 0 0 1 0 3.1l-4.8 4.8a2.2 2.2 0 0 1-3.1 0l-1.1-1.1M13.3 9.6l-1.8-1.8a2.2 2.2 0 0 0-3.1 0l-3.6 3.6a2.2 2.2 0 0 0 0 3.1l3 3" /></svg>
    case 'branch':
      return <svg {...common}><path d="M12 4v5m0 0H6v5m6-5h6v5M3.5 14h5v5h-5zm6 0h5v5h-5zm6 0h5v5h-5z" /></svg>
    case 'member':
      return <svg {...common}><circle cx="12" cy="8" r="3.3" /><path d="M5.5 20c.5-4 2.6-6 6.5-6s6 2 6.5 6" /></svg>
    case 'users':
      return <svg {...common}><circle cx="9" cy="8.5" r="3" /><path d="M3.8 19c.4-3.5 2.1-5.2 5.2-5.2s4.8 1.7 5.2 5.2M15 6.5a3 3 0 0 1 0 5.8m1.5 1.8c2.2.6 3.4 2.2 3.7 4.9" /></svg>
    case 'staff':
      return <svg {...common}><path d="M12 3.5 20 7v5c0 4.5-3 7.3-8 8.5C7 19.3 4 16.5 4 12V7zM9 12l2 2 4-4" /></svg>
  }
}
