import { useLang } from '../contexts/LanguageContext'
import type { RequestType } from '../types'

interface RequestTypeBadgeProps {
  type: RequestType
  className?: string
}

const typeStyle: Record<RequestType, string> = {
  gdpr_art17: 'bg-green-100 text-green-800',
  opt_out:    'bg-amber-100 text-amber-800',
  authority:  'bg-blue-100 text-blue-800',
}

export function RequestTypeBadge({ type, className = '' }: RequestTypeBadgeProps) {
  const { t } = useLang()
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeStyle[type]} ${className}`}
      title={t.common.requestType[type].tooltip}
    >
      {t.common.requestType[type].label}
    </span>
  )
}
