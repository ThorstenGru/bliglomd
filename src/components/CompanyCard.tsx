import { useNavigate } from 'react-router-dom'
import type { Company } from '../types'
import { LevelBadge } from './LevelBadge'

interface CompanyCardProps {
  company: Company
  showCheckbox?: boolean
  checked?: boolean
  onCheck?: (id: string, checked: boolean) => void
}

export function CompanyCard({ company, showCheckbox, checked, onCheck }: CompanyCardProps) {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:border-brand-500 transition-colors">
      {showCheckbox && (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck?.(company.id, e.target.checked)}
          className="h-4 w-4 text-brand-600 rounded border-gray-300"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">{company.name}</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{company.category}</span>
          <span className="text-xs text-gray-400">{company.country}</span>
        </div>
        <div className="flex gap-1 mt-1">
          {company.level1_available && <LevelBadge level={1} />}
          {company.level2_available && <LevelBadge level={2} />}
          {company.level3_available && <LevelBadge level={3} />}
        </div>
      </div>
      <button
        onClick={() => navigate(`/bliglomd/request/${company.id}`)}
        className="shrink-0 bg-brand-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
      >
        Skicka förfrågan
      </button>
    </div>
  )
}
