import type { FileEntry, RecommendationItem } from '../types'

interface DriveSummaryProps {
  entries: FileEntry[]
  recommendations: RecommendationItem[]
}

export default function DriveSummary({ entries, recommendations }: DriveSummaryProps) {
  // Calculate totals
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0)

  // Calculate potential savings (only low-risk, high-confidence items)
  const potentialSavings = recommendations
    .filter(r =>
      r.classification.riskScore <= 2 &&
      r.classification.confidence !== 'low'
    )
    .reduce((sum, r) => sum + r.potentialSavings, 0)

  const usagePercent = Math.min(100, Math.max(0, (totalSize / (totalSize + potentialSavings)) * 100))

  return (
    <div className="bg-white border-b px-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-gray-700 font-medium">
            Drive Analysis
          </span>
          <span className="text-gray-500 ml-2">
            — {formatSize(totalSize)} analysed
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Potential savings identified: {formatSize(potentialSavings)}
          <span className="text-gray-400 ml-1">(verify each item before acting)</span>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${usagePercent}%` }}
        />
      </div>
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
