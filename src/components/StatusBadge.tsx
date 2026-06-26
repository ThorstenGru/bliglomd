import type { Request } from '../types'

interface StatusBadgeProps {
  status: Request['status']
}

const statusConfig: Record<Request['status'], { label: string; color: string }> = {
  pending: { label: 'Väntar', color: 'bg-yellow-100 text-yellow-800' },
  sent: { label: 'Skickad', color: 'bg-blue-100 text-blue-800' },
  confirmed: { label: 'Bekräftad', color: 'bg-green-100 text-green-800' },
  removed: { label: 'Raderad', color: 'bg-green-200 text-green-900' },
  failed: { label: 'Misslyckad', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Utgången', color: 'bg-gray-100 text-gray-600' },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}
