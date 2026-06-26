import { useNavigate } from 'react-router-dom'
import type { Company } from '../types'
import { LevelBadge } from './LevelBadge'
import { useLang } from '../contexts/LanguageContext'

interface CompanyCardProps {
  company: Company
}

export function CompanyCard({ company }: CompanyCardProps) {
  const navigate = useNavigate()
  const { t } = useLang()

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:border-brand-400 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">{company.name}</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{company.category}</span>
          <span className="text-xs text-gray-400">{company.country}</span>
          {company.utgivningsbevis && (
            <span
              className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium"
              title={t.common.utgivningsbevisbadge}
            >
              {t.common.utgivningsbevis}
            </span>
          )}
        </div>
        <div className="flex gap-1 mt-1.5">
          {company.level1_available && <LevelBadge level={1} />}
          {company.level2_available && <LevelBadge level={2} />}
          {company.level3_available && <LevelBadge level={3} />}
        </div>
      </div>
      <button
        onClick={() => navigate(`/request/${company.id}`)}
        className="shrink-0 bg-brand-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
      >
        {t.common.send}
      </button>
    </div>
  )
}
