import type { AuditEvent } from '../api/admin'

export function formatAdminTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai',
  }).format(new Date(value))
}

export function auditResultLabel(event: AuditEvent) {
  if (event.result === 'FAILURE') return '失败 · 未完成'
  if (event.historical) return '成功 · 旧记录'
  if (event.action.endsWith('DRAFT_SAVE')) return '成功 · 未发布'
  if (event.action.endsWith('UNPUBLISH')) return '成功 · 已下架'
  if (event.action.endsWith('PUBLISH')) return '成功 · 已更新线上'
  return event.affectsOnline ? '成功 · 已生效' : '成功'
}

export function auditActorLabel(event: AuditEvent) {
  return event.actorDisplayName || event.actorLoginName || '未登录 / 系统'
}
