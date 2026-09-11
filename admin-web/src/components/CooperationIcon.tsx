import { resolveCooperationIcon } from './cooperationIconConfig'

export function CooperationIcon({ icon, title = '' }: { icon?: string, title?: string }) {
  const resolved = resolveCooperationIcon(icon, title)
  return <span aria-hidden="true" className={`cooperation-icon cooperation-icon--${resolved}`} />
}
