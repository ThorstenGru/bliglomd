import { TIERS } from '../config/tiers'

interface LevelBadgeProps {
  level: 1 | 2 | 3
  className?: string
}

const levelColor = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-purple-100 text-purple-800',
} as const

export function LevelBadge({ level, className = '' }: LevelBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${levelColor[level]} ${className}`}>
      {TIERS[level].name}
    </span>
  )
}
