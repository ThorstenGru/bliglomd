import { useLang } from '../contexts/LanguageContext'
import type { RequestStatus } from '../types'

interface StatusBadgeProps {
  status: RequestStatus
}

const statusColor: Record<RequestStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  sent:      'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  removed:   'bg-green-200 text-green-900',
  failed:    'bg-red-100 text-red-800',
  expired:   'bg-gray-100 text-gray-600',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useLang()
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[status]}`}>
      {t.requestStatus[status]}
    </span>
  )
}
