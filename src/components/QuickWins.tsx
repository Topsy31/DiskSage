import type { RecommendationItem } from '../types'

interface QuickWinsProps {
  recommendations: RecommendationItem[]
  onSelectItem: (item: RecommendationItem) => void
}

export default function QuickWins({ recommendations, onSelectItem }: QuickWinsProps) {
  // Filter to low-risk, high/medium confidence items
  const quickWins = recommendations.filter(r =>
    r.classification.riskScore <= 2 &&
    r.classification.confidence !== 'low'
  ).sort((a, b) => b.potentialSavings - a.potentialSavings)

  const totalSavings = quickWins.reduce((sum, r) => sum + r.potentialSavings, 0)

  if (quickWins.length === 0) {
    return null
  }

  return (
    <div className="bg-green-50 border-b border-green-200 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-green-800">
            Potential Quick Wins
          </h2>
          <p className="text-sm text-green-600">
            Low-risk items that are typically safe to clean up
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-700">
            {formatSize(totalSavings)}
          </div>
          <div className="text-xs text-green-600">
            potential savings
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {quickWins.slice(0, 5).map((item, index) => (
          <button
            key={item.entry.path}
            onClick={() => onSelectItem(item)}
            className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-green-200 hover:border-green-400 transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-medium">
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {item.classification.category}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {item.classification.recommendation}
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 ml-4 text-right">
              <div className="font-semibold text-green-700">
                {formatSize(item.potentialSavings)}
              </div>
              <div className="text-xs text-gray-500">
                {getRiskLabel(item.classification.riskScore)}
              </div>
            </div>
          </button>
        ))}

        {quickWins.length > 5 && (
          <div className="text-sm text-green-600 text-center pt-2">
            + {quickWins.length - 5} more items ({formatSize(
              quickWins.slice(5).reduce((sum, r) => sum + r.potentialSavings, 0)
            )})
          </div>
        )}
      </div>

      <p className="text-xs text-green-600 mt-3">
        Always verify before deleting. Click an item for details.
      </p>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

function getRiskLabel(score: number): string {
  switch (score) {
    case 1: return 'Low risk'
    case 2: return 'Low-medium risk'
    default: return ''
  }
}
