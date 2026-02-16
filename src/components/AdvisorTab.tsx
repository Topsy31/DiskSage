import { useState, useMemo } from 'react'
import type { AdvisorPlan, AdvisorCategory, FileEntry, RecommendationItem, SystemAction } from '../types'

interface AdvisorTabProps {
  entries: FileEntry[]
  recommendations: RecommendationItem[]
  advisorPlan: AdvisorPlan | null
  advisorLoading: boolean
  hasApiKey: boolean
  onGeneratePlan: () => Promise<void>
  onMarkForDeletion: (paths: string[]) => void
  onOpenInExplorer: (path: string) => void
  onOpenSettings: () => void
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

// Resolve an advisor path (possibly anonymised with [USER]/[PROJECT]) to a real entry path
function resolveAdvisorPath(advisorPath: string, entries: FileEntry[]): string {
  // Direct match first
  const direct = entries.find(e => e.path.toLowerCase() === advisorPath.toLowerCase())
  if (direct) return direct.path

  // If path contains [USER] or [PROJECT], build a regex pattern and match
  if (advisorPath.includes('[USER]') || advisorPath.includes('[PROJECT]')) {
    const pattern = advisorPath
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // escape regex chars
      .replace(/\\\[USER\\\]/gi, '[^\\\\]+')     // [USER] matches any path segment
      .replace(/\\\[PROJECT\\\]/gi, '[^\\\\]+')  // [PROJECT] matches any path segment
    const regex = new RegExp('^' + pattern + '$', 'i')
    const match = entries.find(e => regex.test(e.path))
    if (match) return match.path
  }

  return advisorPath
}

export default function AdvisorTab({
  entries,
  advisorPlan,
  advisorLoading,
  hasApiKey,
  onGeneratePlan,
  onMarkForDeletion,
  onOpenInExplorer,
  onOpenSettings
}: AdvisorTabProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['disksage', 'system', 'investigate', 'external'])
  )

  const toggleCategory = (type: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const totalSize = useMemo(() => {
    return entries.reduce((sum, e) => sum + e.size, 0)
  }, [entries])

  // No API key configured
  if (!hasApiKey) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            AI Advisor Not Configured
          </h3>
          <p className="text-gray-600 mb-6">
            To use the AI Advisor, you need to configure your Claude API key.
            The advisor will analyse your scan and suggest a prioritised cleanup plan.
          </p>
          <button
            onClick={onOpenSettings}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Configure API Key
          </button>
        </div>
      </div>
    )
  }

  // Loading state
  if (advisorLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Analysing with AI...</p>
          <p className="text-sm text-gray-500 mt-2">Sending anonymised scan summary to Claude</p>
        </div>
      </div>
    )
  }

  // Ready but no plan yet
  if (!advisorPlan) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Ready to Analyse
          </h3>
          <p className="text-gray-600 mb-2">
            The AI Advisor will analyse your scan results and provide a categorised cleanup plan
            with specific recommendations.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {entries.length} items scanned ({formatSize(totalSize)})
          </p>
          <button
            onClick={onGeneratePlan}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Generate Cleanup Plan
          </button>
          <p className="mt-4 text-xs text-gray-500">
            Top 50 folders by size will be sent to Claude (paths anonymised for privacy)
          </p>
        </div>
      </div>
    )
  }

  // Plan displayed
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-6 flex-shrink-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              AI Cleanup Plan
            </h2>
            <p className="text-sm text-gray-500">
              Generated {new Date(advisorPlan.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onGeneratePlan}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Regenerate
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-gray-700">{advisorPlan.summary}</p>
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {advisorPlan.categories.map((category) => (
          <CategoryCard
            key={category.type}
            category={category}
            entries={entries}
            isExpanded={expandedCategories.has(category.type)}
            onToggle={() => toggleCategory(category.type)}
            onMarkForDeletion={onMarkForDeletion}
            onOpenInExplorer={onOpenInExplorer}
          />
        ))}

        {advisorPlan.categories.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No recommendations generated. Try regenerating the plan.
          </div>
        )}
      </div>
    </div>
  )
}

// Category card component

interface CategoryCardProps {
  category: AdvisorCategory
  entries: FileEntry[]
  isExpanded: boolean
  onToggle: () => void
  onMarkForDeletion: (paths: string[]) => void
  onOpenInExplorer: (path: string) => void
}

function CategoryCard({
  category,
  entries,
  isExpanded,
  onToggle,
  onMarkForDeletion,
  onOpenInExplorer
}: CategoryCardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleMarkAll = () => {
    if (category.items) {
      const paths = category.items.map(item => resolveAdvisorPath(item.path, entries))
      onMarkForDeletion(paths)
    }
  }

  const colours: Record<string, { bg: string; border: string; header: string; badge: string }> = {
    disksage: { bg: 'bg-green-50', border: 'border-green-200', header: 'text-green-900', badge: 'bg-green-100 text-green-700' },
    system: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'text-blue-900', badge: 'bg-blue-100 text-blue-700' },
    investigate: { bg: 'bg-amber-50', border: 'border-amber-200', header: 'text-amber-900', badge: 'bg-amber-100 text-amber-700' },
    external: { bg: 'bg-gray-50', border: 'border-gray-200', header: 'text-gray-900', badge: 'bg-gray-100 text-gray-700' }
  }

  const scheme = colours[category.type] || colours.external

  return (
    <div className={`border rounded-lg ${scheme.border} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className={`w-full px-5 py-4 flex items-center justify-between ${scheme.bg} hover:opacity-90`}
      >
        <div className="flex items-center gap-3">
          <span className={`font-semibold ${scheme.header}`}>
            {category.title}
          </span>
          {category.totalSize != null && category.totalSize > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${scheme.badge}`}>
              {formatSize(category.totalSize)}
            </span>
          )}
          {category.items && (
            <span className="text-xs text-gray-500">
              {category.items.length} {category.items.length === 1 ? 'item' : 'items'}
            </span>
          )}
          {category.actions && (
            <span className="text-xs text-gray-500">
              {category.actions.length} {category.actions.length === 1 ? 'action' : 'actions'}
            </span>
          )}
        </div>
        <span className="text-gray-400 text-sm">
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-3 bg-white space-y-3">
          <p className="text-sm text-gray-600">{category.description}</p>

          {/* Category A: DiskSage items */}
          {category.type === 'disksage' && category.items && category.items.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={handleMarkAll}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Mark All for Deletion
              </button>
              {category.items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-md p-3 border border-gray-200">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={item.path}>
                        {item.path.split('\\').pop() || item.path}
                      </p>
                      <p className="text-xs text-gray-500 truncate" title={item.path}>
                        {item.path}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                    </div>
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      {formatSize(item.size)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onMarkForDeletion([resolveAdvisorPath(item.path, entries)])}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Mark
                    </button>
                    <button
                      onClick={() => onOpenInExplorer(resolveAdvisorPath(item.path, entries))}
                      className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Category B: System actions */}
          {category.type === 'system' && category.actions && category.actions.length > 0 && (
            <div className="space-y-3">
              {category.guidance && (
                <p className="text-sm text-gray-600 italic">{category.guidance}</p>
              )}
              {category.actions.map((action: SystemAction) => (
                <div key={action.id} className="bg-gray-50 rounded-md p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{action.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      action.riskLevel === 'low' ? 'bg-green-100 text-green-700' :
                      action.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {action.riskLevel} risk
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{action.explanation}</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Estimated savings: {action.estimatedSavings}
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs mb-3 overflow-x-auto whitespace-pre-wrap">
                    {action.command}
                  </div>
                  <button
                    onClick={() => handleCopy(action.command, action.id)}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {copiedId === action.id ? 'Copied!' : 'Copy Command'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Category C: Investigate */}
          {category.type === 'investigate' && category.items && category.items.length > 0 && (
            <div className="space-y-2">
              {category.items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-md p-3 border border-gray-200">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate" title={item.path}>
                        {item.path.split('\\').pop() || item.path}
                      </p>
                      <p className="text-xs text-gray-500 truncate" title={item.path}>
                        {item.path}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                    </div>
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      {formatSize(item.size)}
                    </span>
                  </div>
                  <button
                    onClick={() => onOpenInExplorer(item.path)}
                    className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Open in Explorer
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Category D: External tools */}
          {category.type === 'external' && category.guidance && (
            <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
              <p className="text-sm text-gray-700 whitespace-pre-line">{category.guidance}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
