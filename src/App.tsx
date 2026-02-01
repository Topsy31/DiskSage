import { useState, useCallback } from 'react'
import { AppState, FileEntry, RecommendationItem } from './types'
import SafetyIntro from './components/SafetyIntro'
import ImportPanel from './components/ImportPanel'
import DriveSummary from './components/DriveSummary'
import RecommendationList from './components/RecommendationList'
import DetailPanel from './components/DetailPanel'
import ReportProblem from './components/ReportProblem'

const initialState: AppState = {
  phase: 'intro',
  safetyConfirmed: false,
  entries: [],
  recommendations: [],
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
      setState(prev => ({
        ...prev,
        entries,
        recommendations,
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

  const handleSelectItem = useCallback((item: RecommendationItem | null) => {
    setState(prev => ({ ...prev, selectedItem: item }))
  }, [])

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
      // Update the item with web research results
      setState(prev => ({
        ...prev,
        isLoading: false
        // Web research results would be stored separately or merged into classification
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

      {state.phase === 'results' && (
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

            <RecommendationList
              recommendations={state.recommendations}
              selectedItem={state.selectedItem}
              onSelect={handleSelectItem}
            />
          </div>

          {state.selectedItem && (
            <DetailPanel
              item={state.selectedItem}
              onClose={() => handleSelectItem(null)}
              onOpenInExplorer={handleOpenInExplorer}
              onAskAI={handleAskAI}
              onWebResearch={handleWebResearch}
              isLoading={state.isLoading}
            />
          )}
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

export default App
