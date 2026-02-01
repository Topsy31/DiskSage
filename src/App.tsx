import { useState, useCallback, useEffect } from 'react'
import { AppState, FileEntry, RecommendationItem, TreeNode, RemovalTestJob } from './types'
import { buildTree } from './utils/treeBuilder'
import StartScreen from './components/StartScreen'
import ReportProblem from './components/ReportProblem'
import TabContainer, { TabId } from './components/TabContainer'
import ExploreTab from './components/ExploreTab'
import ByRiskTab from './components/ByRiskTab'
import MarkedTab from './components/MarkedTab'

const initialState: AppState = {
  phase: 'start',
  safetyConfirmed: true,
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
  const [activeTab, setActiveTab] = useState<TabId>('explore')
  const [markedPaths, setMarkedPaths] = useState<Set<string>>(new Set())

  // Load active test and previous session on mount
  useEffect(() => {
    // Load active test
    window.electronAPI.getActiveTest().then(test => {
      if (test) {
        setActiveTest(test)
        // If there's an active test, switch to marked tab
        setActiveTab('marked')
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

        // Load marked paths if stored
        if (session.markedPaths && session.markedPaths.length > 0) {
          setMarkedPaths(new Set(session.markedPaths))
        }

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

  const handleScanComplete = useCallback(async (entries: FileEntry[], source: string) => {
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
      setCsvFilePath(source)

      // Clear marked paths on new scan
      setMarkedPaths(new Set())

      await window.electronAPI.saveSession(source, entries, recommendations, [])

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

  const handleBack = useCallback(() => {
    // Go back to results if we have data, otherwise stay on start
    if (state.entries.length > 0) {
      setState(prev => ({ ...prev, phase: 'results' }))
    }
  }, [state.entries.length])

  const handleSelectNode = useCallback((node: TreeNode | null) => {
    if (!node) {
      setState(prev => ({ ...prev, selectedNode: null, selectedItem: null }))
      return
    }

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

  // Mark/unmark for deletion
  const handleMarkForDeletion = useCallback((path: string) => {
    setMarkedPaths(prev => {
      const next = new Set(prev)
      next.add(path.toLowerCase())
      return next
    })
  }, [])

  const handleMarkMultipleForDeletion = useCallback((paths: string[]) => {
    setMarkedPaths(prev => {
      const next = new Set(prev)
      for (const path of paths) {
        next.add(path.toLowerCase())
      }
      return next
    })
    // Switch to marked tab after marking
    setActiveTab('marked')
  }, [])

  const handleUnmarkForDeletion = useCallback((path: string) => {
    setMarkedPaths(prev => {
      const next = new Set(prev)
      next.delete(path.toLowerCase())
      return next
    })
  }, [])

  const handleClearAllMarked = useCallback(() => {
    setMarkedPaths(new Set())
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

      // Compute new marked paths
      const newMarkedPaths = new Set<string>()
      for (const path of markedPaths) {
        if (!deletedPaths.has(path)) {
          newMarkedPaths.add(path)
        }
      }
      setMarkedPaths(newMarkedPaths)

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

        // Update saved session with new marked paths
        if (csvFilePath) {
          window.electronAPI.saveSession(csvFilePath, newEntries, newRecommendations, Array.from(newMarkedPaths))
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
  }, [activeTest, csvFilePath, markedPaths])

  // Calculate total size
  const totalSize = state.entries.reduce((sum, e) => sum + e.size, 0)

  // Tab configuration with counts
  const tabs = [
    { id: 'explore' as TabId, label: 'Explore' },
    { id: 'by-risk' as TabId, label: 'By Risk' },
    { id: 'marked' as TabId, label: 'Marked', count: markedPaths.size }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {state.phase === 'start' && (
        <StartScreen
          onScanComplete={handleScanComplete}
          onBack={state.entries.length > 0 ? handleBack : undefined}
          isLoading={state.isLoading}
          error={state.error}
        />
      )}

      {state.phase === 'results' && state.tree && (
        <div className="flex flex-col h-screen">
          {/* Header */}
          <header className="bg-white border-b px-6 py-3 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-gray-900">DiskSage</h1>
              <span className="text-sm text-gray-500">
                Analysed: {formatSize(totalSize)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setState(prev => ({ ...prev, phase: 'start', selectedNode: null, selectedItem: null }))}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                New Scan
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Report Problem
              </button>
            </div>
          </header>

          {/* Tabs and content */}
          <TabContainer
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabs}
          >
            {activeTab === 'explore' && (
              <ExploreTab
                tree={state.tree}
                recommendations={state.recommendations}
                selectedNode={state.selectedNode}
                onSelectNode={handleSelectNode}
                onOpenInExplorer={handleOpenInExplorer}
                onAskAI={handleAskAI}
                onWebResearch={handleWebResearch}
                onMarkForDeletion={handleMarkForDeletion}
                onUnmarkForDeletion={handleUnmarkForDeletion}
                markedPaths={markedPaths}
                isLoading={state.isLoading}
              />
            )}

            {activeTab === 'by-risk' && (
              <ByRiskTab
                recommendations={state.recommendations}
                onMarkForDeletion={handleMarkMultipleForDeletion}
                onSelectItem={(item) => {
                  setState(prev => ({ ...prev, selectedItem: item, selectedNode: null }))
                  setActiveTab('explore')
                }}
                markedPaths={markedPaths}
              />
            )}

            {activeTab === 'marked' && (
              <MarkedTab
                recommendations={state.recommendations}
                entries={state.entries}
                markedPaths={markedPaths}
                onUnmark={handleUnmarkForDeletion}
                onClearAll={handleClearAllMarked}
                activeTest={activeTest}
                onTestRemoval={handleTestRemoval}
                onUndoTest={handleUndoTest}
                onConfirmDelete={handleConfirmDelete}
                isTestLoading={testLoading}
              />
            )}
          </TabContainer>
        </div>
      )}

      {showReportModal && state.selectedItem && (
        <ReportProblem
          item={state.selectedItem}
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

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

export default App
