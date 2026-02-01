import { useState, useCallback, useMemo } from 'react'
import { AppState, FileEntry, RecommendationItem, TreeNode } from './types'
import { buildTree } from './utils/treeBuilder'
import SafetyIntro from './components/SafetyIntro'
import ImportPanel from './components/ImportPanel'
import DriveSummary from './components/DriveSummary'
import QuickWins from './components/QuickWins'
import TreeView from './components/TreeView'
import DetailPanel from './components/DetailPanel'
import ReportProblem from './components/ReportProblem'

const initialState: AppState = {
  phase: 'intro',
  safetyConfirmed: false,
  entries: [],
  recommendations: [],
  tree: null,
  selectedNode: null,
  selectedItem: null,
  isLoading: false,
  error: null
}

function App() {
  const [state, setState] = useState<AppState>(initialState)
  const [showReportModal, setShowReportModal] = useState(false)

  const handleSafetyConfirmed = useCallback(() => {
    setState(prev => ({ ...prev, safetyConfirmed: true, phase: 'import' }))
  }, [])

  const handleFileImport = useCallback(async (entries: FileEntry[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const recommendations = await window.electronAPI.analyzeEntries(entries)

      // Build a lookup map for classifications
      const classificationMap = new Map<string, RecommendationItem>()
      for (const rec of recommendations) {
        classificationMap.set(rec.entry.path.toLowerCase(), rec)
      }

      // Build tree with classification lookup
      const tree = buildTree(entries, (path) => {
        const rec = classificationMap.get(path.toLowerCase())
        return rec?.classification
      })

      setState(prev => ({
        ...prev,
        entries,
        recommendations,
        tree,
        phase: 'results',
        isLoading: false
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Analysis failed',
        isLoading: false
      }))
    }
  }, [])

  const handleSelectNode = useCallback((node: TreeNode) => {
    // Find matching recommendation
    const rec = state.recommendations.find(
      r => r.entry.path.toLowerCase() === node.path.toLowerCase()
    )

    setState(prev => ({
      ...prev,
      selectedNode: node,
      selectedItem: rec || null
    }))
  }, [state.recommendations])

  const handleOpenInExplorer = useCallback((path: string) => {
    window.electronAPI.openInExplorer(path)
  }, [])

  const handleAskAI = useCallback(async (item: RecommendationItem) => {
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      const updatedClassification = await window.electronAPI.askAI(item.entry)
      setState(prev => ({
        ...prev,
        recommendations: prev.recommendations.map(r =>
          r.entry.path === item.entry.path
            ? { ...r, classification: updatedClassification }
            : r
        ),
        selectedItem: prev.selectedItem?.entry.path === item.entry.path
          ? { ...prev.selectedItem, classification: updatedClassification }
          : prev.selectedItem,
        isLoading: false
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'AI request failed',
        isLoading: false
      }))
    }
  }, [])

  const handleWebResearch = useCallback(async (item: RecommendationItem) => {
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      const result = await window.electronAPI.webResearch(item.entry.path)
      setState(prev => ({
        ...prev,
        isLoading: false
      }))
      return result
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Web research failed',
        isLoading: false
      }))
    }
  }, [])

  // Create a pseudo-RecommendationItem for selected node if we don't have one
  const selectedItem = useMemo(() => {
    if (state.selectedItem) return state.selectedItem
    if (!state.selectedNode) return null

    // Create a basic item from the node
    return {
      entry: {
        path: state.selectedNode.path,
        size: state.selectedNode.size,
        allocated: state.selectedNode.size,
        modified: new Date(),
        attributes: ''
      },
      classification: state.selectedNode.classification || {
        riskScore: 3 as const,
        confidence: 'low' as const,
        category: 'Unknown',
        recommendation: 'Needs investigation',
        explanation: 'This folder was not recognised. Use "Ask AI" or investigate manually.',
        source: 'offline-rule' as const,
        warnings: []
      },
      potentialSavings: state.selectedNode.size
    }
  }, [state.selectedItem, state.selectedNode])

  return (
    <div className="min-h-screen bg-gray-50">
      {state.phase === 'intro' && (
        <SafetyIntro onConfirm={handleSafetyConfirmed} />
      )}

      {state.phase === 'import' && (
        <ImportPanel
          onImport={handleFileImport}
          isLoading={state.isLoading}
          error={state.error}
        />
      )}

      {state.phase === 'results' && state.tree && (
        <div className="flex h-screen">
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
              <h1 className="text-xl font-semibold text-gray-900">DiskSage</h1>
              <button
                onClick={() => setShowReportModal(true)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Report Problem
              </button>
            </header>

            <DriveSummary
              entries={state.entries}
              recommendations={state.recommendations}
            />

            <QuickWins
              recommendations={state.recommendations}
              onSelectItem={(item) => {
                setState(prev => ({ ...prev, selectedItem: item, selectedNode: null }))
              }}
            />

            <TreeView
              root={state.tree}
              onSelectNode={handleSelectNode}
              selectedPath={state.selectedNode?.path || null}
            />
          </div>

          {selectedItem && (
            <DetailPanel
              item={selectedItem}
              onClose={() => setState(prev => ({ ...prev, selectedNode: null, selectedItem: null }))}
              onOpenInExplorer={handleOpenInExplorer}
              onAskAI={handleAskAI}
              onWebResearch={handleWebResearch}
              isLoading={state.isLoading}
            />
          )}
        </div>
      )}

      {showReportModal && selectedItem && (
        <ReportProblem
          item={selectedItem}
          onClose={() => setShowReportModal(false)}
          onSubmit={async (report) => {
            await window.electronAPI.submitReport(report)
            setShowReportModal(false)
          }}
        />
      )}

      {state.error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {state.error}
          <button
            onClick={() => setState(prev => ({ ...prev, error: null }))}
            className="ml-4 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

export default App
