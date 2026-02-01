import { useState, useMemo } from 'react'
import type { RecommendationItem } from '../types'
import RiskBadge from './RiskBadge'

type RiskFilter = 'low' | 'moderate' | 'high' | 'unknown'

interface ByRiskTabProps {
  recommendations: RecommendationItem[]
  onMarkForDeletion: (paths: string[]) => void
  onSelectItem: (item: RecommendationItem) => void
  markedPaths: Set<string>
}

export default function ByRiskTab({
  recommendations,
  onMarkForDeletion,
  onSelectItem,
  markedPaths
}: ByRiskTabProps) {
  const [activeFilter, setActiveFilter] = useState<RiskFilter>('low')
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())

  // Categorize recommendations by risk
  const categorized = useMemo(() => {
    const low: RecommendationItem[] = []
    const moderate: RecommendationItem[] = []
    const high: RecommendationItem[] = []
    const unknown: RecommendationItem[] = []

    for (const rec of recommendations) {
      const { riskScore, confidence } = rec.classification

      // Already marked - skip
      if (markedPaths.has(rec.entry.path.toLowerCase())) continue

      if (riskScore <= 2 && confidence !== 'low') {
        low.push(rec)
      } else if (riskScore === 3 || (riskScore <= 2 && confidence === 'low')) {
        moderate.push(rec)
      } else if (riskScore >= 4) {
        high.push(rec)
      } else {
        unknown.push(rec)
      }
    }

    // Sort each by size descending
    const sortBySize = (a: RecommendationItem, b: RecommendationItem) => b.entry.size - a.entry.size

    return {
      low: low.sort(sortBySize),
      moderate: moderate.sort(sortBySize),
      high: high.sort(sortBySize),
      unknown: unknown.sort(sortBySize)
    }
  }, [recommendations, markedPaths])

  const currentItems = categorized[activeFilter]

  const toggleSelect = (path: string) => {
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

  const toggleSelectAll = () => {
    if (selectedPaths.size === currentItems.length) {
      setSelectedPaths(new Set())
    } else {
      setSelectedPaths(new Set(currentItems.map(r => r.entry.path)))
    }
  }

  const handleMarkSelected = () => {
    if (selectedPaths.size > 0) {
      onMarkForDeletion(Array.from(selectedPaths))
      setSelectedPaths(new Set())
    }
  }

  const selectedSize = useMemo(() => {
    return currentItems
      .filter(r => selectedPaths.has(r.entry.path))
      .reduce((sum, r) => sum + r.entry.size, 0)
  }, [currentItems, selectedPaths])

  const filters: { id: RiskFilter; label: string; count: number }[] = [
    { id: 'low', label: 'Low Risk', count: categorized.low.length },
    { id: 'moderate', label: 'Moderate', count: categorized.moderate.length },
    { id: 'high', label: 'High Risk', count: categorized.high.length },
    { id: 'unknown', label: 'Unknown', count: categorized.unknown.length }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Sub-filter tabs */}
      <div className="border-b bg-gray-50 px-4 py-2 flex gap-2 flex-shrink-0">
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => {
              setActiveFilter(filter.id)
              setSelectedPaths(new Set())
            }}
            className={`
              px-3 py-1.5 text-sm rounded-full transition-colors
              ${activeFilter === filter.id
                ? filter.id === 'low' ? 'bg-green-100 text-green-700' :
                  filter.id === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                  filter.id === 'high' ? 'bg-red-100 text-red-700' :
                  'bg-gray-200 text-gray-700'
                : 'bg-white text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            {filter.label}
            {filter.count > 0 && (
              <span className="ml-1.5 opacity-75">({filter.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Selection bar */}
      {currentItems.length > 0 && (
        <div className="border-b bg-white px-4 py-2 flex items-center justify-between flex-shrink-0">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedPaths.size === currentItems.length && currentItems.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-300"
            />
            Select all ({currentItems.length})
          </label>
          <div className="flex items-center gap-4">
            {selectedPaths.size > 0 && (
              <span className="text-sm text-gray-500">
                {selectedPaths.size} selected ({formatSize(selectedSize)})
              </span>
            )}
            <button
              onClick={handleMarkSelected}
              disabled={selectedPaths.size === 0}
              className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark for Deletion
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {currentItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {activeFilter === 'low' && 'No low-risk items found'}
            {activeFilter === 'moderate' && 'No moderate-risk items found'}
            {activeFilter === 'high' && 'No high-risk items found'}
            {activeFilter === 'unknown' && 'No unknown items found'}
          </div>
        ) : (
          <div className="divide-y">
            {currentItems.map(item => (
              <RiskItem
                key={item.entry.path}
                item={item}
                isSelected={selectedPaths.has(item.entry.path)}
                onToggleSelect={() => toggleSelect(item.entry.path)}
                onViewDetails={() => onSelectItem(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface RiskItemProps {
  item: RecommendationItem
  isSelected: boolean
  onToggleSelect: () => void
  onViewDetails: () => void
}

function RiskItem({ item, isSelected, onToggleSelect, onViewDetails }: RiskItemProps) {
  const { entry, classification } = item

  // Get folder name from path
  const folderName = entry.path.split('\\').pop() || entry.path

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 truncate">{folderName}</span>
          <RiskBadge score={classification.riskScore} />
        </div>
        <p className="text-sm text-gray-500 truncate" title={entry.path}>
          {entry.path}
        </p>
        <p className="text-sm text-gray-600 mt-0.5">
          {classification.recommendation}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="font-medium text-gray-700">{formatSize(entry.size)}</div>
        <button
          onClick={onViewDetails}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Details
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
