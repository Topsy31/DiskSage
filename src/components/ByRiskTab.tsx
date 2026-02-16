import { useState, useMemo, useCallback } from 'react'
import type { RecommendationItem, Classification, WebResearchResult } from '../types'
import { formatSize, deduplicatePaths, calculateDeduplicatedSize } from '../utils/treeBuilder'
import RiskBadge, { RiskIndicator } from './RiskBadge'
import ConfidenceBadge from './ConfidenceBadge'

type RiskFilter = 'low' | 'moderate' | 'high' | 'unknown'

interface ByRiskTabProps {
  recommendations: RecommendationItem[]
  onMarkForDeletion: (paths: string[]) => void
  onUnmarkForDeletion: (path: string) => void
  onOpenInExplorer: (path: string) => void
  onAskAI: (item: RecommendationItem) => void
  onWebResearch: (item: RecommendationItem) => Promise<WebResearchResult | null>
  markedPaths: Set<string>
  isLoading: boolean
}

export default function ByRiskTab({
  recommendations,
  onMarkForDeletion,
  onUnmarkForDeletion,
  onOpenInExplorer,
  onAskAI,
  onWebResearch,
  markedPaths,
  isLoading
}: ByRiskTabProps) {
  const [activeFilter, setActiveFilter] = useState<RiskFilter>('low')
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [selectedItem, setSelectedItem] = useState<RecommendationItem | null>(null)

  // Risk filter functions
  const riskFilters: Record<RiskFilter, (c: Classification) => boolean> = {
    low: (c) => c.riskScore <= 2 && c.confidence !== 'low',
    moderate: (c) => c.riskScore === 3 || (c.riskScore <= 2 && c.confidence === 'low'),
    high: (c) => c.riskScore >= 4,
    unknown: () => false
  }

  // Filter recommendations by risk level, excluding already marked items
  const filteredItems = useMemo(() => {
    return recommendations.filter(rec => {
      const pathLower = rec.entry.path.toLowerCase()
      if (markedPaths.has(pathLower)) return false
      return riskFilters[activeFilter](rec.classification)
    }).sort((a, b) => b.entry.size - a.entry.size) // Sort by size descending
  }, [recommendations, activeFilter, markedPaths])

  // Count items per category (excluding marked)
  const categoryCounts = useMemo(() => {
    const counts = { low: 0, moderate: 0, high: 0, unknown: 0 }

    for (const rec of recommendations) {
      const pathLower = rec.entry.path.toLowerCase()
      if (markedPaths.has(pathLower)) continue

      const { riskScore, confidence } = rec.classification

      if (riskScore <= 2 && confidence !== 'low') {
        counts.low++
      } else if (riskScore === 3 || (riskScore <= 2 && confidence === 'low')) {
        counts.moderate++
      } else if (riskScore >= 4) {
        counts.high++
      } else {
        counts.unknown++
      }
    }

    return counts
  }, [recommendations, markedPaths])

  // Build size map for deduplication calculations
  const entrySizeMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const rec of recommendations) {
      map.set(rec.entry.path.toLowerCase(), rec.entry.size)
    }
    return map
  }, [recommendations])

  const toggleSelect = useCallback((path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      const pathLower = path.toLowerCase()
      if (next.has(pathLower)) {
        next.delete(pathLower)
      } else {
        next.add(pathLower)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedPaths.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedPaths(new Set())
    } else {
      setSelectedPaths(new Set(filteredItems.map(item => item.entry.path.toLowerCase())))
    }
  }, [filteredItems, selectedPaths.size])

  const handleMarkSelected = useCallback(() => {
    if (selectedPaths.size > 0) {
      // Deduplicate paths before marking (in case user selected parent and child)
      const deduped = deduplicatePaths(selectedPaths)
      onMarkForDeletion(Array.from(deduped))
      setSelectedPaths(new Set())
    }
  }, [selectedPaths, onMarkForDeletion])

  // Calculate deduplicated size for selected items
  const { totalSize: selectedSize, excludedCount } = useMemo(() => {
    return calculateDeduplicatedSize(
      selectedPaths,
      (path) => entrySizeMap.get(path) || 0
    )
  }, [selectedPaths, entrySizeMap])

  const handleViewDetails = useCallback((item: RecommendationItem) => {
    setSelectedItem(item)
  }, [])

  const handleCloseDetails = useCallback(() => {
    setSelectedItem(null)
  }, [])

  const isSelectedMarked = selectedItem ? markedPaths.has(selectedItem.entry.path.toLowerCase()) : false

  const filters: { id: RiskFilter; label: string; count: number }[] = [
    { id: 'low', label: 'Low Risk', count: categoryCounts.low },
    { id: 'moderate', label: 'Moderate', count: categoryCounts.moderate },
    { id: 'high', label: 'High Risk', count: categoryCounts.high },
    { id: 'unknown', label: 'Unknown', count: categoryCounts.unknown }
  ]

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Sub-filter tabs */}
        <div className="border-b bg-gray-50 px-4 py-2 flex gap-2 flex-shrink-0">
          {filters.map(filter => (
            <button
              key={filter.id}
              onClick={() => {
                setActiveFilter(filter.id)
                setSelectedPaths(new Set())
                setSelectedItem(null)
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
        {filteredItems.length > 0 && (
          <div className="border-b bg-white px-4 py-2 flex items-center justify-between flex-shrink-0">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPaths.size === filteredItems.length && filteredItems.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300"
              />
              Select all ({filteredItems.length})
            </label>
            <div className="flex items-center gap-4">
              {selectedPaths.size > 0 && (
                <span className="text-sm text-gray-500">
                  {selectedPaths.size} selected ({formatSize(selectedSize)})
                  {excludedCount > 0 && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({excludedCount} nested)
                    </span>
                  )}
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

        {/* List header */}
        <div className="sticky top-0 bg-gray-100 border-b px-4 py-2 flex items-center text-sm font-medium text-gray-600 flex-shrink-0">
          <div className="w-6" /> {/* Checkbox space */}
          <div className="flex-1 ml-2">Folder</div>
          <div className="w-24 text-right">Size</div>
          <div className="w-24 text-right">Risk</div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {activeFilter === 'low' && 'No low-risk items found'}
              {activeFilter === 'moderate' && 'No moderate-risk items found'}
              {activeFilter === 'high' && 'No high-risk items found'}
              {activeFilter === 'unknown' && 'No unknown items found'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredItems.map(item => (
                <RiskListRow
                  key={item.entry.path}
                  item={item}
                  isSelected={selectedPaths.has(item.entry.path.toLowerCase())}
                  isViewing={selectedItem?.entry.path === item.entry.path}
                  onToggleSelect={() => toggleSelect(item.entry.path)}
                  onViewDetails={() => handleViewDetails(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <RiskDetailPanel
          item={selectedItem}
          onClose={handleCloseDetails}
          onOpenInExplorer={onOpenInExplorer}
          onAskAI={onAskAI}
          onWebResearch={onWebResearch}
          onMarkForDeletion={() => onMarkForDeletion([selectedItem.entry.path])}
          onUnmarkForDeletion={() => onUnmarkForDeletion(selectedItem.entry.path)}
          isMarked={isSelectedMarked}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}

interface RiskListRowProps {
  item: RecommendationItem
  isSelected: boolean
  isViewing: boolean
  onToggleSelect: () => void
  onViewDetails: () => void
}

function RiskListRow({
  item,
  isSelected,
  isViewing,
  onToggleSelect,
  onViewDetails
}: RiskListRowProps) {
  const { entry, classification } = item
  const folderName = entry.path.split('\\').pop() || entry.path

  return (
    <div
      className={`flex items-center px-4 py-2 transition-colors cursor-pointer ${
        isViewing
          ? 'bg-blue-50 border-l-4 border-blue-500'
          : isSelected
            ? 'bg-blue-50 border-l-4 border-transparent'
            : 'hover:bg-gray-50 border-l-4 border-transparent'
      }`}
    >
      {/* Checkbox */}
      <div className="w-6 flex-shrink-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300"
        />
      </div>

      {/* Name and path */}
      <div
        className="flex-1 min-w-0 ml-2"
        onClick={onViewDetails}
      >
        <div className="font-medium text-gray-800 truncate" title={entry.path}>
          {folderName}
        </div>
        <div className="text-xs text-gray-500 truncate" title={entry.path}>
          {entry.path}
        </div>
      </div>

      {/* Size */}
      <div className="w-24 text-right text-sm text-gray-600 flex-shrink-0">
        {formatSize(entry.size)}
      </div>

      {/* Risk badge */}
      <div className="w-24 text-right flex-shrink-0">
        <div className="flex items-center justify-end">
          <RiskBadge score={classification.riskScore} />
        </div>
      </div>
    </div>
  )
}

// Detail panel for By Risk tab
interface RiskDetailPanelProps {
  item: RecommendationItem
  onClose: () => void
  onOpenInExplorer: (path: string) => void
  onAskAI: (item: RecommendationItem) => void
  onWebResearch: (item: RecommendationItem) => Promise<WebResearchResult | null>
  onMarkForDeletion: () => void
  onUnmarkForDeletion: () => void
  isMarked: boolean
  isLoading: boolean
}

function RiskDetailPanel({
  item,
  onClose,
  onOpenInExplorer,
  onAskAI,
  onWebResearch,
  onMarkForDeletion,
  onUnmarkForDeletion,
  isMarked,
  isLoading
}: RiskDetailPanelProps) {
  const { entry, classification } = item
  const [webResults, setWebResults] = useState<WebResearchResult | null>(null)

  const handleWebResearch = async () => {
    const result = await onWebResearch(item)
    if (result) {
      setWebResults(result)
    }
  }

  return (
    <div className="w-96 bg-white border-l flex flex-col h-full overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">
            {classification.category}
          </h2>
          <p className="text-sm text-gray-500 truncate" title={entry.path}>
            {entry.path}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl ml-2"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Risk and Confidence */}
        <div className="flex items-center gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Risk</div>
            <RiskIndicator score={classification.riskScore} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Confidence</div>
            <ConfidenceBadge confidence={classification.confidence} />
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-gray-500 mb-1">Size</div>
            <div className="font-medium">{formatSize(entry.size)}</div>
          </div>
        </div>

        {/* Mark for deletion status */}
        {isMarked && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-red-700 font-medium">Marked for deletion</span>
            <button
              onClick={onUnmarkForDeletion}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Unmark
            </button>
          </div>
        )}

        {/* Recommendation */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700">
            {classification.recommendation}
          </p>
        </div>

        {/* Action buttons for unknown items */}
        {classification.confidence === 'low' && (
          <div className="flex gap-2">
            <button
              onClick={() => onAskAI(item)}
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
            >
              Ask AI
            </button>
            <button
              onClick={handleWebResearch}
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              Research Online
            </button>
          </div>
        )}

        {/* Warnings */}
        {classification.warnings.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-amber-700">Warnings</h3>
            {classification.warnings.map((warning, i) => (
              <div key={i} className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                {warning.message}
              </div>
            ))}
          </div>
        )}

        {/* Explanation */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">What is this?</h3>
          <p className="text-sm text-gray-600">
            {classification.explanation}
          </p>
        </div>

        {/* Web Research Results */}
        {webResults && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">
              Web Research Results
            </h3>

            <div className={`p-3 rounded-lg ${
              webResults.consensus === 'safe' ? 'bg-green-50 text-green-700' :
              webResults.consensus === 'dangerous' ? 'bg-red-50 text-red-700' :
              webResults.consensus === 'conflicting' ? 'bg-amber-50 text-amber-700' :
              'bg-gray-50 text-gray-700'
            }`}>
              <div className="font-medium mb-1">
                Consensus: {webResults.consensus}
              </div>
              <p className="text-sm">{webResults.summary}</p>
            </div>

            {webResults.edgeCases.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                <div className="text-sm font-medium text-amber-700 mb-1">
                  Edge cases found:
                </div>
                <ul className="text-sm text-amber-600 list-disc list-inside">
                  {webResults.edgeCases.map((edge, i) => (
                    <li key={i}>{edge}</li>
                  ))}
                </ul>
              </div>
            )}

            {webResults.sources.map((source, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    source.trustLevel === 'official' ? 'bg-blue-100 text-blue-700' :
                    source.trustLevel === 'expert' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-200 text-gray-700'
                  }`}>
                    {source.trustLevel}
                  </span>
                  <span className="font-medium truncate">{source.domain}</span>
                </div>
                <p className="text-gray-600 line-clamp-2">{source.snippet}</p>
              </div>
            ))}
          </div>
        )}

        {/* File details */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between">
              <dt className="text-gray-500">Modified:</dt>
              <dd className="text-gray-700">{formatDate(entry.modified)}</dd>
            </div>
            {entry.files !== undefined && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Files:</dt>
                <dd className="text-gray-700">{entry.files.toLocaleString()}</dd>
              </div>
            )}
            {entry.folders !== undefined && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Folders:</dt>
                <dd className="text-gray-700">{entry.folders.toLocaleString()}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Source:</dt>
              <dd className="text-gray-700">{classification.source}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t space-y-2">
        {!isMarked ? (
          <button
            onClick={onMarkForDeletion}
            className="w-full px-4 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Mark for Deletion
          </button>
        ) : (
          <button
            onClick={onUnmarkForDeletion}
            className="w-full px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Remove from Deletion List
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onOpenInExplorer(entry.path)}
            className="flex-1 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Open in Explorer
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(entry.path)}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Copy Path
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
