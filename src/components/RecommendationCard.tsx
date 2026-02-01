import type { RecommendationItem } from '../types'
import RiskBadge from './RiskBadge'
import ConfidenceBadge from './ConfidenceBadge'

interface RecommendationCardProps {
  item: RecommendationItem
  isSelected: boolean
  onSelect: () => void
}

export default function RecommendationCard({ item, isSelected, onSelect }: RecommendationCardProps) {
  const { entry, classification } = item

  // Get folder name from path
  const pathParts = entry.path.split('\\')
  const folderName = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || entry.path

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 border rounded-lg transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {classification.category === 'Unknown' && (
              <span className="text-gray-400 text-sm">?</span>
            )}
            <h3 className="font-medium text-gray-900 truncate">
              {classification.category !== 'Unknown' ? classification.category : folderName}
            </h3>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <RiskBadge score={classification.riskScore} />
            <ConfidenceBadge confidence={classification.confidence} />
          </div>

          <p className="text-sm text-gray-600 line-clamp-1">
            {classification.recommendation}
          </p>

          {classification.warnings.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-amber-600 text-xs">
              <span>!</span>
              <span>{classification.warnings.length} warning{classification.warnings.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <div className="font-medium text-gray-900">
            {formatSize(entry.size)}
          </div>
          <button className="text-gray-400 text-lg hover:text-gray-600">
            &gt;
          </button>
        </div>
      </div>
    </button>
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}
