export const cooperationIconOptions = [
  { key: 'cooperate', label: '合作' },
  { key: 'people', label: '人员' },
  { key: 'lodging', label: '住宿' },
  { key: 'product', label: '产品' },
  { key: 'nature', label: '自然' },
  { key: 'service', label: '服务' },
  { key: 'blessing', label: '祈福' },
  { key: 'scenic', label: '山水' },
  { key: 'tea', label: '茶品' },
  { key: 'general', label: '通用' },
] as const

export type CooperationIconKey = typeof cooperationIconOptions[number]['key']

const iconKeys = new Set<string>(cooperationIconOptions.map((option) => option.key))
const titleIconRules: Array<[string, CooperationIconKey]> = [
  ['招商', 'cooperate'],
  ['合作', 'cooperate'],
  ['招募', 'people'],
  ['会员', 'people'],
  ['民宿', 'lodging'],
  ['住宿', 'lodging'],
  ['基础业务', 'lodging'],
  ['供应链', 'product'],
  ['产品', 'product'],
  ['衍生', 'nature'],
  ['文旅', 'nature'],
  ['特色服务', 'service'],
  ['服务', 'service'],
  ['祈福', 'blessing'],
  ['增项', 'blessing'],
  ['景区', 'scenic'],
  ['山水', 'scenic'],
  ['茶', 'tea'],
]

export function resolveCooperationIcon(icon: string | undefined, title: string): CooperationIconKey {
  if (icon && iconKeys.has(icon)) return icon as CooperationIconKey
  return titleIconRules.find(([keyword]) => title.includes(keyword))?.[1] ?? 'general'
}
