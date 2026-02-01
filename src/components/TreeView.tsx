import { useState, useMemo, useCallback } from 'react'
import type { TreeNode, Classification } from '../types'
import { getVisibleNodes, formatSize, getPercentOfParent } from '../utils/treeBuilder'
import RiskBadge from './RiskBadge'

interface TreeViewProps {
  root: TreeNode
  onSelectNode: (node: TreeNode) => void
  selectedPath: string | null
}

export default function TreeView({ root, onSelectNode, selectedPath }: TreeViewProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Start with top-level folders expanded
    const initial = new Set<string>()
    initial.add(root.path)
    return initial
  })

  const toggleExpand = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const visibleNodes = useMemo(() => {
    return getVisibleNodes(root, expandedPaths)
  }, [root, expandedPaths])

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-100 border-b px-4 py-2 flex items-center text-sm font-medium text-gray-600">
        <div className="flex-1">Folder</div>
        <div className="w-24 text-right">Size</div>
        <div className="w-32 text-right">Risk</div>
      </div>

      {/* Tree rows */}
      <div className="divide-y divide-gray-100">
        {visibleNodes.map(node => (
          <TreeRow
            key={node.path}
            node={node}
            isExpanded={expandedPaths.has(node.path)}
            isSelected={selectedPath === node.path}
            parentSize={root.size}
            onToggle={toggleExpand}
            onSelect={() => onSelectNode(node)}
          />
        ))}
      </div>

      {visibleNodes.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No folders to display
        </div>
      )}
    </div>
  )
}

interface TreeRowProps {
  node: TreeNode
  isExpanded: boolean
  isSelected: boolean
  parentSize: number
  onToggle: (path: string, e: React.MouseEvent) => void
  onSelect: () => void
}

function TreeRow({ node, isExpanded, isSelected, parentSize, onToggle, onSelect }: TreeRowProps) {
  const hasChildren = node.children.length > 0
  const percent = getPercentOfParent(node, parentSize)
  const indent = node.depth * 20

  return (
    <div
      onClick={onSelect}
      className={`flex items-center px-4 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-50 border-l-4 border-blue-500'
          : 'hover:bg-gray-50 border-l-4 border-transparent'
      }`}
    >
      {/* Expand/collapse + name */}
      <div className="flex-1 flex items-center min-w-0" style={{ paddingLeft: indent }}>
        {hasChildren ? (
          <button
            onClick={(e) => onToggle(node.path, e)}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-6" />
        )}

        <span className="truncate font-medium text-gray-800" title={node.path}>
          {node.name}
        </span>

        {/* Percentage bar */}
        {percent > 0 && (
          <div className="ml-3 flex items-center gap-2 flex-shrink-0">
            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${getBarColor(node.classification)}`}
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8">{percent}%</span>
          </div>
        )}
      </div>

      {/* Size */}
      <div className="w-24 text-right text-sm text-gray-600 flex-shrink-0">
        {formatSize(node.size)}
      </div>

      {/* Risk badge */}
      <div className="w-32 text-right flex-shrink-0">
        {node.classification ? (
          <div className="flex items-center justify-end gap-1">
            <RiskBadge score={node.classification.riskScore} />
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </div>
    </div>
  )
}

function getBarColor(classification?: Classification): string {
  if (!classification) return 'bg-gray-400'

  switch (classification.riskScore) {
    case 1: return 'bg-green-500'
    case 2: return 'bg-lime-500'
    case 3: return 'bg-yellow-500'
    case 4: return 'bg-orange-500'
    case 5: return 'bg-red-500'
    default: return 'bg-gray-400'
  }
}
