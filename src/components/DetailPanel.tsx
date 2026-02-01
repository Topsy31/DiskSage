import type { RecommendationItem, WebResearchResult } from '../types'
import { useState } from 'react'
import { RiskIndicator } from './RiskBadge'
import ConfidenceBadge from './ConfidenceBadge'

interface DetailPanelProps {
  item: RecommendationItem
  onClose: () => void
  onOpenInExplorer: (path: string) => void
  onAskAI: (item: RecommendationItem) => void
  onWebResearch: (item: RecommendationItem) => Promise<WebResearchResult | undefined>
  isLoading: boolean
}

export default function DetailPanel({
  item,
  onClose,
  onOpenInExplorer,
  onAskAI,
  onWebResearch,
  isLoading
}: DetailPanelProps) {
  const { entry, classification } = item
  const [webResults, setWebResults] = useState<WebResearchResult | null>(null)

  const handleWebResearch = async () => {
    const result = await onWebResearch(item)
    if (result) {
      setWebResults(result)
    }
  }

  return (
    <div className="w-96 bg-white border-l flex flex-col h-full overflow-hidden">
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
          x
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
      <div className="p-4 border-t flex gap-2">
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
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
