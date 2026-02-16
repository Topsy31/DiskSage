import { useState, useCallback, useEffect } from 'react'
import { AppState, FileEntry, RecommendationItem, TreeNode, RemovalTestJob, AdvisorPlan } from './types'
import { buildTree } from './utils/treeBuilder'
import StartScreen from './components/StartScreen'
import ReportProblem from './components/ReportProblem'
import TabContainer, { TabId } from './components/TabContainer'
import ExploreTab from './components/ExploreTab'
import ByRiskTab from './components/ByRiskTab'
import MarkedTab from './components/MarkedTab'
import AdvisorTab from './components/AdvisorTab'
import DuplicatesTab from './components/DuplicatesTab'
import SettingsPanel from './components/SettingsPanel'

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
  const [backupLocation, setBackupLocation] = useState<string | null>(null)
  const [advisorPlan, setAdvisorPlan] = useState<AdvisorPlan | null>(null)
  const [advisorLoading, setAdvisorLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Load active test, backup location, and API key status on mount
  useEffect(() => {
    window.electronAPI.getActiveTest().then(test => {
      if (test) {
        setActiveTest(test)
      }
    })

    // Load saved backup location
    window.electronAPI.getBackupLocation().then(location => {
      if (location) {
        setBackupLocation(location)
      }
    })

    // Check for API key
    window.electronAPI.getClaudeApiKey().then(key => {
      setHasApiKey(!!key)
    })
  }, [])

  // Function to load previous session when user chooses to continue
  const loadPreviousSession = useCallback(async () => {
    const session = await window.electronAPI.loadSession()
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

      // Restore advisor plan if it exists
      if (session.advisorPlan) {
        setAdvisorPlan(session.advisorPlan)
      }

      // If there's an active test, switch to marked tab
      if (activeTest) {
        setActiveTab('marked')
      }

      setState(prev => ({
        ...prev,
        entries: session.entries,
        recommendations: session.recommendations,
        tree,
        phase: 'results',
        safetyConfirmed: true
      }))

      return true
    }
    return false
  }, [activeTest])

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

      // Clear marked paths and advisor plan on new scan
      setMarkedPaths(new Set())
      setAdvisorPlan(null)

      await window.electronAPI.saveSession(source, entries, recommendations, [], null)

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
      return null
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

  // Backup location handler
  const handleBackupLocationChange = useCallback((location: string | null) => {
    setBackupLocation(location)
  }, [])

  // Removal test handlers
  const handleTestRemoval = useCallback(async (entries: FileEntry[], backupLoc: string) => {
    setTestLoading(true)
    try {
      // Pass backup location to disableItems
      const job = await window.electronAPI.disableItems(entries, backupLoc)
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

  // AI Advisor handlers
  const handleGenerateAdvisorPlan = useCallback(async () => {
    setAdvisorLoading(true)
    setState(prev => ({ ...prev, error: null }))

    try {
      const plan = await window.electronAPI.getAdvisorPlan(state.entries, state.entries.reduce((sum, e) => sum + e.size, 0))
      setAdvisorPlan(plan)

      // Save plan to session
      if (csvFilePath) {
        await window.electronAPI.saveSession(
          csvFilePath,
          state.entries,
          state.recommendations,
          Array.from(markedPaths),
          plan
        )
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to generate advisor plan'
      }))
    } finally {
      setAdvisorLoading(false)
    }
  }, [state.entries, state.recommendations, csvFilePath, markedPaths])

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true)
  }, [])

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false)
    // Recheck API key after settings close
    window.electronAPI.getClaudeApiKey().then(key => {
      setHasApiKey(!!key)
    })
  }, [])

  // Calculate total size
  const totalSize = state.entries.reduce((sum, e) => sum + e.size, 0)

  // Tab configuration with counts
  const tabs = [
    { id: 'explore' as TabId, label: 'Explore' },
    { id: 'by-risk' as TabId, label: 'By Risk' },
    { id: 'marked' as TabId, label: 'Marked', count: markedPaths.size },
    { id: 'advisor' as TabId, label: 'Advisor' },
    { id: 'duplicates' as TabId, label: 'Duplicates' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {state.phase === 'start' && (
        <StartScreen
          onScanComplete={handleScanComplete}
          onContinueSession={loadPreviousSession}
          onFindDuplicates={() => {
            setState(prev => ({ ...prev, phase: 'results' }))
            setActiveTab('duplicates')
          }}
          hasActiveTest={!!activeTest}
          isLoading={state.isLoading}
          error={state.error}
        />
      )}

      {state.phase === 'results' && (state.tree || activeTab === 'duplicates') && (
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
                onClick={handleOpenSettings}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Settings
              </button>
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
                tree={state.tree!}
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
                onUnmarkForDeletion={handleUnmarkForDeletion}
                onOpenInExplorer={handleOpenInExplorer}
                onAskAI={handleAskAI}
                onWebResearch={handleWebResearch}
                markedPaths={markedPaths}
                isLoading={state.isLoading}
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
                backupLocation={backupLocation}
                onBackupLocationChange={handleBackupLocationChange}
              />
            )}

            {activeTab === 'advisor' && (
              <AdvisorTab
                entries={state.entries}
                recommendations={state.recommendations}
                advisorPlan={advisorPlan}
                advisorLoading={advisorLoading}
                hasApiKey={hasApiKey}
                onGeneratePlan={handleGenerateAdvisorPlan}
                onMarkForDeletion={handleMarkMultipleForDeletion}
                onOpenInExplorer={handleOpenInExplorer}
                onOpenSettings={handleOpenSettings}
              />
            )}

            {activeTab === 'duplicates' && (
              <DuplicatesTab
                backupLocation={backupLocation}
                onBackupLocationChange={handleBackupLocationChange}
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

      {showSettings && (
        <SettingsPanel onClose={handleCloseSettings} />
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
