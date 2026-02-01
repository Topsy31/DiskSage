import { useState, useCallback, useMemo, useEffect } from 'react'
import { AppState, FileEntry, RecommendationItem, TreeNode, RemovalTestJob } from './types'
import { buildTree } from './utils/treeBuilder'
import SafetyIntro from './components/SafetyIntro'
import ImportPanel from './components/ImportPanel'
import DriveSummary from './components/DriveSummary'
import QuickWins from './components/QuickWins'
import TreeView from './components/TreeView'
import DetailPanel from './components/DetailPanel'
import ReportProblem from './components/ReportProblem'
import TestBanner from './components/TestBanner'

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
  const [activeTest, setActiveTest] = useState<RemovalTestJob | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [csvFilePath, setCsvFilePath] = useState<string | null>(null)

  // Load active test and previous session on mount
  useEffect(() => {
    // Load active test
    window.electronAPI.getActiveTest().then(test => {
      if (test) {
        setActiveTest(test)
      }
    })

    // Load previous session
    window.electronAPI.loadSession().then(session => {
      if (session) {
        // Build a lookup map for classifications
        const classificationMap = new Map<string, RecommendationItem>()
        for (const rec of session.recommendations) {
          classificationMap.set(rec.entry.path.toLowerCase(), rec)
        }

        // Build tree with classification lookup
        const tree = buildTree(session.entries, (path) => {
          const rec = classificationMap.get(path.toLowerCase())
          return rec?.classification
        })

        setCsvFilePath(session.csvFilePath)
        setState(prev => ({
          ...prev,
          entries: session.entries,
          recommendations: session.recommendations,
          tree,
          phase: 'results',
          safetyConfirmed: true
        }))
      }
    })
  }, [])

  const handleSafetyConfirmed = useCallback(() => {
    setState(prev => ({ ...prev, safetyConfirmed: true, phase: 'import' }))
  }, [])

  const handleFileImport = useCallback(async (entries: FileEntry[], filePath: string) => {
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

      // Save session for persistence
      setCsvFilePath(filePath)
      await window.electronAPI.saveSession(filePath, entries, recommendations)

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

  // Removal test handlers
  const handleTestRemoval = useCallback(async (entries: FileEntry[]) => {
    setTestLoading(true)
    try {
      const job = await window.electronAPI.disableItems(entries)
      setActiveTest(job)
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to start test'
      }))
    } finally {
      setTestLoading(false)
    }
  }, [])

  const handleUndoTest = useCallback(async () => {
    if (!activeTest) return
    setTestLoading(true)
    try {
      await window.electronAPI.restoreItems(activeTest)
      setActiveTest(null)
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to restore items'
      }))
    } finally {
      setTestLoading(false)
    }
  }, [activeTest])

  const handleConfirmDelete = useCallback(async () => {
    if (!activeTest) return
    setTestLoading(true)
    try {
      const result = await window.electronAPI.deleteDisabledItems(activeTest)
      setActiveTest(null)

      // Get paths of successfully deleted items
      const deletedPaths = new Set(
        activeTest.items
          .filter(item => item.status === 'renamed')
          .map(item => item.originalPath.toLowerCase())
      )

      // Remove deleted items from entries and recommendations
      setState(prev => {
        const newEntries = prev.entries.filter(
          e => !deletedPaths.has(e.path.toLowerCase())
        )
        const newRecommendations = prev.recommendations.filter(
          r => !deletedPaths.has(r.entry.path.toLowerCase())
        )

        // Rebuild tree
        const classificationMap = new Map<string, RecommendationItem>()
        for (const rec of newRecommendations) {
          classificationMap.set(rec.entry.path.toLowerCase(), rec)
        }
        const newTree = buildTree(newEntries, (path) => {
          const rec = classificationMap.get(path.toLowerCase())
          return rec?.classification
        })

        // Update saved session
        if (csvFilePath) {
          window.electronAPI.saveSession(csvFilePath, newEntries, newRecommendations)
        }

        return {
          ...prev,
          entries: newEntries,
          recommendations: newRecommendations,
          tree: newTree,
          selectedNode: null,
          selectedItem: null,
          error: result.failed.length > 0
            ? `Deleted ${result.deleted} items. ${result.failed.length} failed.`
            : null
        }
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to delete items'
      }))
    } finally {
      setTestLoading(false)
    }
  }, [activeTest, csvFilePath])

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
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h1 className="text-xl font-semibold text-gray-900">DiskSage</h1>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setState(prev => ({ ...prev, phase: 'import', selectedNode: null, selectedItem: null }))}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Import New CSV
                </button>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Report Problem
                </button>
              </div>
            </header>

            {activeTest && (
              <TestBanner
                job={activeTest}
                onUndo={handleUndoTest}
                onConfirmDelete={handleConfirmDelete}
                isLoading={testLoading}
              />
            )}

            <DriveSummary
              entries={state.entries}
              recommendations={state.recommendations}
            />

            <QuickWins
              recommendations={state.recommendations}
              onSelectItem={(item) => {
                setState(prev => ({ ...prev, selectedItem: item, selectedNode: null }))
              }}
              onTestRemoval={handleTestRemoval}
              testActive={activeTest !== null}
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
