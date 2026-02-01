import { useMemo } from 'react'
import type { RecommendationItem, RemovalTestJob, FileEntry } from '../types'
import RiskBadge from './RiskBadge'

interface MarkedTabProps {
  recommendations: RecommendationItem[]
  entries: FileEntry[]
  markedPaths: Set<string>
  onUnmark: (path: string) => void
  onClearAll: () => void
  activeTest: RemovalTestJob | null
  onTestRemoval: (entries: FileEntry[]) => void
  onUndoTest: () => void
  onConfirmDelete: () => void
  isTestLoading: boolean
}

export default function MarkedTab({
  recommendations,
  entries,
  markedPaths,
  onUnmark,
  onClearAll,
  activeTest,
  onTestRemoval,
  onUndoTest,
  onConfirmDelete,
  isTestLoading
}: MarkedTabProps) {
  // Get marked items with their recommendations
  const markedItems = useMemo(() => {
    const items: { entry: FileEntry; recommendation?: RecommendationItem }[] = []

    for (const path of markedPaths) {
      const rec = recommendations.find(r => r.entry.path.toLowerCase() === path)
      const entry = rec?.entry || entries.find(e => e.path.toLowerCase() === path)

      if (entry) {
        items.push({ entry, recommendation: rec })
      }
    }

    // Sort by size descending
    return items.sort((a, b) => b.entry.size - a.entry.size)
  }, [markedPaths, recommendations, entries])

  const totalSize = useMemo(() => {
    return markedItems.reduce((sum, item) => sum + item.entry.size, 0)
  }, [markedItems])

  const handleStartTest = () => {
    const entriesToTest = markedItems.map(item => item.entry)
    onTestRemoval(entriesToTest)
  }

  // Get items from active test if one is in progress
  const activeTestItems = useMemo(() => {
    if (!activeTest) return []

    return activeTest.items.map(item => {
      const rec = recommendations.find(r => r.entry.path.toLowerCase() === item.originalPath.toLowerCase())
      return {
        entry: item.entry,
        recommendation: rec,
        testItem: item
      }
    }).sort((a, b) => b.entry.size - a.entry.size)
  }, [activeTest, recommendations])

  // Calculate total size for active test
  const activeTestTotalSize = useMemo(() => {
    return activeTestItems.reduce((sum, item) => sum + item.entry.size, 0)
  }, [activeTestItems])

  if (markedItems.length === 0 && !activeTest) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <p className="text-lg font-medium">No items marked for deletion</p>
        <p className="text-sm mt-1">
          Use the "Explore" or "By Risk" tabs to find and mark items
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Active test banner */}
      {activeTest && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-amber-800">
                Testing removal: {activeTest.items.length} item{activeTest.items.length !== 1 ? 's' : ''} disabled ({formatSize(activeTestTotalSize)})
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Use your system normally. If something breaks, click "Undo All" to restore.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={onUndoTest}
                disabled={isTestLoading}
                className="px-4 py-2 text-sm bg-white border border-amber-300 text-amber-700 rounded hover:bg-amber-50 disabled:opacity-50"
              >
                {isTestLoading ? 'Working...' : 'Undo All'}
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={isTestLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isTestLoading ? 'Working...' : 'Confirm & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary header */}
      {!activeTest && markedItems.length > 0 && (
        <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <span className="font-medium text-gray-700">
              {markedItems.length} item{markedItems.length !== 1 ? 's' : ''} marked
            </span>
            <span className="text-gray-500 ml-2">
              ({formatSize(totalSize)})
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Clear All
            </button>
            <button
              onClick={handleStartTest}
              disabled={isTestLoading}
              className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
            >
              Test Removal
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y">
          {activeTest ? (
            // Show items from active test
            activeTestItems.map(({ entry, recommendation, testItem }) => (
              <TestItem
                key={entry.path}
                entry={entry}
                recommendation={recommendation}
                status={testItem.status}
                renamedPath={testItem.renamedPath}
              />
            ))
          ) : (
            // Show marked items
            markedItems.map(({ entry, recommendation }) => (
              <MarkedItem
                key={entry.path}
                entry={entry}
                recommendation={recommendation}
                onUnmark={() => onUnmark(entry.path)}
                disabled={false}
              />
            ))
          )}
        </div>
      </div>

      {/* Instructions footer */}
      {!activeTest && markedItems.length > 0 && (
        <div className="border-t bg-gray-50 px-4 py-3 flex-shrink-0">
          <p className="text-sm text-gray-600">
            <strong>How it works:</strong> "Test Removal" renames items so they can't be used.
            If something breaks, "Undo All" restores them instantly.
            Once you're confident, "Confirm & Delete" removes them permanently.
          </p>
        </div>
      )}
    </div>
  )
}

interface MarkedItemProps {
  entry: FileEntry
  recommendation?: RecommendationItem
  onUnmark: () => void
  disabled: boolean
}

function MarkedItem({ entry, recommendation, onUnmark, disabled }: MarkedItemProps) {
  const folderName = entry.path.split('\\').pop() || entry.path
  const classification = recommendation?.classification

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 truncate">{folderName}</span>
          {classification && <RiskBadge score={classification.riskScore} />}
        </div>
        <p className="text-sm text-gray-500 truncate" title={entry.path}>
          {entry.path}
        </p>
        {classification && (
          <p className="text-sm text-gray-600 mt-0.5">
            {classification.recommendation}
          </p>
        )}
      </div>

      <div className="text-right flex-shrink-0 flex items-center gap-4">
        <div className="font-medium text-gray-700">{formatSize(entry.size)}</div>
        {!disabled && (
          <button
            onClick={onUnmark}
            className="text-sm text-gray-500 hover:text-red-600"
            title="Remove from deletion list"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

interface TestItemProps {
  entry: FileEntry
  recommendation?: RecommendationItem
  status: 'pending' | 'renamed' | 'restored' | 'deleted' | 'failed'
  renamedPath?: string
}

function TestItem({ entry, recommendation, status, renamedPath }: TestItemProps) {
  const folderName = entry.path.split('\\').pop() || entry.path
  const classification = recommendation?.classification

  const statusColors = {
    pending: 'bg-gray-100 text-gray-600',
    renamed: 'bg-amber-100 text-amber-700',
    restored: 'bg-green-100 text-green-700',
    deleted: 'bg-red-100 text-red-700',
    failed: 'bg-red-100 text-red-700'
  }

  const statusLabels = {
    pending: 'Pending',
    renamed: 'Disabled',
    restored: 'Restored',
    deleted: 'Deleted',
    failed: 'Failed'
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 truncate">{folderName}</span>
          {classification && <RiskBadge score={classification.riskScore} />}
          <span className={`px-2 py-0.5 text-xs rounded ${statusColors[status]}`}>
            {statusLabels[status]}
          </span>
        </div>
        <p className="text-sm text-gray-500 truncate" title={entry.path}>
          {entry.path}
        </p>
        {status === 'renamed' && renamedPath && (
          <p className="text-xs text-amber-600 truncate mt-0.5" title={renamedPath}>
            Renamed to: {renamedPath.split('\\').pop()}
          </p>
        )}
        {classification && (
          <p className="text-sm text-gray-600 mt-0.5">
            {classification.recommendation}
          </p>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <div className="font-medium text-gray-700">{formatSize(entry.size)}</div>
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
