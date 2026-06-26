interface LevelBadgeProps {
  level: 1 | 2 | 3
  className?: string
}

const levelConfig = {
  1: { label: 'L1 Hitta', color: 'bg-green-100 text-green-800' },
  2: { label: 'L2 Skicka', color: 'bg-blue-100 text-blue-800' },
  3: { label: 'L3 Bevaka', color: 'bg-purple-100 text-purple-800' },
}

export function LevelBadge({ level, className = '' }: LevelBadgeProps) {
  const config = levelConfig[level]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${className}`}>
      {config.label}
    </span>
  )
}
