import { useState, useMemo } from 'react'
import type { RecommendationItem, FileEntry } from '../types'

interface QuickWinsProps {
  recommendations: RecommendationItem[]
  onSelectItem: (item: RecommendationItem) => void
  onTestRemoval: (entries: FileEntry[]) => void
  testActive: boolean
}

export default function QuickWins({
  recommendations,
  onSelectItem,
  onTestRemoval,
  testActive
}: QuickWinsProps) {
  const [showAll, setShowAll] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())

  // Filter to low-risk, high/medium confidence items
  const quickWins = useMemo(() =>
    recommendations.filter(r =>
      r.classification.riskScore <= 2 &&
      r.classification.confidence !== 'low'
    ).sort((a, b) => b.potentialSavings - a.potentialSavings),
    [recommendations]
  )

  // Initialize selection with all items when quickWins changes
  useMemo(() => {
    if (selectedPaths.size === 0 && quickWins.length > 0) {
      setSelectedPaths(new Set(quickWins.map(q => q.entry.path)))
    }
  }, [quickWins.length])

  const displayedItems = showAll ? quickWins : quickWins.slice(0, 5)
  const hiddenCount = quickWins.length - 5

  const selectedItems = quickWins.filter(q => selectedPaths.has(q.entry.path))
  const totalSelected = selectedItems.reduce((sum, r) => sum + r.potentialSavings, 0)
  const totalSavings = quickWins.reduce((sum, r) => sum + r.potentialSavings, 0)

  const toggleItem = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedPaths.size === quickWins.length) {
      setSelectedPaths(new Set())
    } else {
      setSelectedPaths(new Set(quickWins.map(q => q.entry.path)))
    }
  }

  const handleTestRemoval = () => {
    const entries = selectedItems.map(item => item.entry)
    onTestRemoval(entries)
  }

  if (quickWins.length === 0) {
    return null
  }

  return (
    <div className="bg-green-50 border-b border-green-200 px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-green-800">
            Quick Wins - Low Risk Items
          </h2>
          <p className="text-sm text-green-600">
            Low-risk items that are typically safe to clean up
          </p>
        </div>
        <div className="flex items-center gap-4">
          {quickWins.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-green-700 hover:text-green-900 underline"
            >
              {showAll ? 'Show Top 5' : `Show All (${quickWins.length})`}
            </button>
          )}
          <div className="text-right">
            <div className="text-2xl font-bold text-green-700">
              {formatSize(totalSavings)}
            </div>
            <div className="text-xs text-green-600">
              potential savings
            </div>
          </div>
        </div>
      </div>

      {/* Select All / Selection Summary */}
      <div className="flex items-center justify-between mb-2 px-1">
        <label className="flex items-center gap-2 text-sm text-green-700 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedPaths.size === quickWins.length}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500"
          />
          Select all ({quickWins.length} items)
        </label>
        <span className="text-sm text-green-600">
          {selectedPaths.size} selected ({formatSize(totalSelected)})
        </span>
      </div>

      <div className={`space-y-2 ${showAll ? 'max-h-64 overflow-y-auto pr-2' : ''}`}>
        {displayedItems.map((item, index) => (
          <div
            key={item.entry.path}
            className="flex items-center gap-2"
          >
            <input
              type="checkbox"
              checked={selectedPaths.has(item.entry.path)}
              onChange={() => toggleItem(item.entry.path)}
              className="w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500 flex-shrink-0"
            />
            <button
              onClick={() => onSelectItem(item)}
              className="flex-1 flex items-center justify-between p-3 bg-white rounded-lg border border-green-200 hover:border-green-400 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {item.classification.category}
                  </div>
                  <div className="text-sm text-gray-500 truncate" title={item.entry.path}>
                    {item.entry.path}
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
          </div>
        ))}

        {!showAll && hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-sm text-green-600 hover:text-green-800 text-center py-2 hover:underline"
          >
            + {hiddenCount} more items ({formatSize(
              quickWins.slice(5).reduce((sum, r) => sum + r.potentialSavings, 0)
            )})
          </button>
        )}
      </div>

      {/* Test Removal Button */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-green-600">
          Test removal renames items temporarily. You can undo instantly if something breaks.
        </p>
        <button
          onClick={handleTestRemoval}
          disabled={selectedPaths.size === 0 || testActive}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testActive ? 'Test Active' : `Test Removal (${selectedPaths.size} items)`}
        </button>
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

function getRiskLabel(score: number): string {
  switch (score) {
    case 1: return 'Low risk'
    case 2: return 'Low-medium risk'
    default: return ''
  }
}
