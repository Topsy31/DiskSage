import { useState, useMemo } from 'react'
import type { RecommendationItem, Confidence } from '../types'
import RecommendationCard from './RecommendationCard'

interface RecommendationListProps {
  recommendations: RecommendationItem[]
  selectedItem: RecommendationItem | null
  onSelect: (item: RecommendationItem | null) => void
}

type SortBy = 'size' | 'risk' | 'confidence'
type FilterConfidence = 'all' | Confidence

export default function RecommendationList({
  recommendations,
  selectedItem,
  onSelect
}: RecommendationListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('size')
  const [filterConfidence, setFilterConfidence] = useState<FilterConfidence>('all')
  const [showUnknown, setShowUnknown] = useState(true)

  const filteredAndSorted = useMemo(() => {
    let result = [...recommendations]

    // Filter by confidence
    if (filterConfidence !== 'all') {
      result = result.filter(r => r.classification.confidence === filterConfidence)
    }

    // Filter unknown
    if (!showUnknown) {
      result = result.filter(r => r.classification.category !== 'Unknown')
    }

    // Sort
    if (sortBy === 'size') {
      result.sort((a, b) => b.entry.size - a.entry.size)
    } else if (sortBy === 'risk') {
      result.sort((a, b) => a.classification.riskScore - b.classification.riskScore)
    } else if (sortBy === 'confidence') {
      const order = { high: 0, medium: 1, low: 2 }
      result.sort((a, b) =>
        order[a.classification.confidence] - order[b.classification.confidence]
      )
    }

    return result
  }, [recommendations, sortBy, filterConfidence, showUnknown])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filters */}
      <div className="px-6 py-3 bg-gray-50 border-b flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort:</label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="size">Size (largest first)</option>
            <option value="risk">Risk (safest first)</option>
            <option value="confidence">Confidence (highest first)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Confidence:</label>
          <select
            value={filterConfidence}
            onChange={e => setFilterConfidence(e.target.value as FilterConfidence)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">All</option>
            <option value="high">High only</option>
            <option value="medium">Medium only</option>
            <option value="low">Low only</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showUnknown}
            onChange={e => setShowUnknown(e.target.checked)}
            className="rounded"
          />
          Show unknown items
        </label>

        <span className="text-sm text-gray-500 ml-auto">
          Showing {filteredAndSorted.length} of {recommendations.length} items
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {filteredAndSorted.map((item, index) => (
            <RecommendationCard
              key={item.entry.path || index}
              item={item}
              isSelected={selectedItem?.entry.path === item.entry.path}
              onSelect={() => onSelect(item)}
            />
          ))}

          {filteredAndSorted.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No items match the current filters
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
