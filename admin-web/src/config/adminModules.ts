import type { AdminIconName } from '../components/AdminIcon'

export interface AdminModuleDefinition {
  to: string
  label: string
  group: string
  icon: AdminIconName
  description?: string
  end?: boolean
  permission?: string
  workspace?: boolean
  workspaceLabel?: string
}

export const adminModules: AdminModuleDefinition[] = [
  { to: '/', label: '工作台', group: '概览', icon: 'dashboard', end: true },
  { to: '/home-hero', label: '首页头图', group: '内容运营', icon: 'hero', description: '首页首屏画面与文案', permission: 'content:read', workspace: true },
  { to: '/home-videos', label: '首页宣传视频', workspaceLabel: '宣传视频', group: '内容运营', icon: 'video', description: '视频封面与播放内容', permission: 'content:read', workspace: true },
  { to: '/company', label: '公司介绍', group: '内容运营', icon: 'company', description: '品牌简介与展示图片', permission: 'content:read', workspace: true },
  { to: '/scenics', label: '景区管理', group: '内容运营', icon: 'scenic', description: '景区内容、顺序与导航', permission: 'content:read', workspace: true },
  { to: '/products', label: '会员福利管理', workspaceLabel: '会员福利', group: '内容运营', icon: 'gift', description: '福利分类与产品内容', permission: 'content:read', workspace: true },
  { to: '/cooperation', label: '收益板块管理', workspaceLabel: '合作权益', group: '合作权益', icon: 'cooperation', description: '收益来源与合作价值', permission: 'content:read', workspace: true },
  { to: '/cooperation/branch', label: '分公司方案', group: '合作权益', icon: 'branch', permission: 'content:read' },
  { to: '/cooperation/membership', label: '会员体系', group: '合作权益', icon: 'member', permission: 'content:read' },
  { to: '/users', label: '注册用户', group: '系统管理', icon: 'users', permission: 'user:read' },
  { to: '/staff', label: '后台人员', group: '系统管理', icon: 'staff', permission: 'staff:manage' },
]

export const adminNavigationGroups = ['概览', '内容运营', '合作权益', '系统管理'].map((label) => ({
  label,
  links: adminModules.filter((module) => module.group === label),
}))

export const workspaceModules = adminModules.filter((module) => module.workspace)

export function findAdminModule(pathname: string) {
  return [...adminModules]
    .sort((left, right) => right.to.length - left.to.length)
    .find((module) => module.to === '/' ? pathname === '/' : pathname === module.to || pathname.startsWith(`${module.to}/`))
}
