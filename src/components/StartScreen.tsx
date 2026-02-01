import { useState, useEffect, useCallback } from 'react'
import type { FileEntry } from '../types'

interface ScanTarget {
  id: string
  name: string
  description: string
  category: string
  availablePaths: string[]
  exists: boolean
}

interface StartScreenProps {
  onScanComplete: (entries: FileEntry[], source: string) => void
  onBack?: () => void
  isLoading: boolean
  error: string | null
}

export default function StartScreen({ onScanComplete, onBack, isLoading, error }: StartScreenProps) {
  const [targets, setTargets] = useState<ScanTarget[]>([])
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set())
  const [scanProgress, setScanProgress] = useState<{ current: string; scanned: number; total: number } | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [mode, setMode] = useState<'choose' | 'scanning' | 'csv'>('choose')

  // Load available scan targets
  useEffect(() => {
    window.electronAPI.getScanTargets().then(availableTargets => {
      setTargets(availableTargets)
      // Pre-select temp and cache targets
      const defaultSelected = new Set<string>()
      for (const t of availableTargets) {
        if (t.exists && (t.category === 'temp' || t.category === 'cache')) {
          defaultSelected.add(t.id)
        }
      }
      setSelectedTargets(defaultSelected)
    })

    // Listen for scan progress
    const unsubscribe = window.electronAPI.onScanProgress(progress => {
      setScanProgress(progress)
    })

    return unsubscribe
  }, [])

  const toggleTarget = (id: string) => {
    setSelectedTargets(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleQuickScan = useCallback(async () => {
    if (selectedTargets.size === 0) {
      setLocalError('Please select at least one location to scan')
      return
    }

    setLocalError(null)
    setMode('scanning')
    setScanProgress({ current: 'Starting scan...', scanned: 0, total: selectedTargets.size })

    try {
      const entries = await window.electronAPI.quickScan(Array.from(selectedTargets))

      if (entries.length === 0) {
        setLocalError('No files found in selected locations')
        setMode('choose')
        return
      }

      onScanComplete(entries, 'quick-scan')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Scan failed')
      setMode('choose')
    }
  }, [selectedTargets, onScanComplete])

  const handleCSVImport = useCallback(async () => {
    setLocalError(null)
    setMode('csv')

    try {
      const filePath = await window.electronAPI.selectCSVFile()

      if (!filePath) {
        setMode('choose')
        return
      }

      setScanProgress({ current: 'Reading CSV file...', scanned: 0, total: 1 })

      const entries = await window.electronAPI.parseCSV(filePath)

      if (entries && entries.length > 0) {
        onScanComplete(entries, filePath)
      } else {
        setLocalError('No entries found in CSV file. Make sure this is a WizTree export.')
        setMode('choose')
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to import CSV')
      setMode('choose')
    }
  }, [onScanComplete])

  const displayError = error || localError

  // Group targets by category
  const groupedTargets = targets.reduce((acc, target) => {
    if (!acc[target.category]) {
      acc[target.category] = []
    }
    acc[target.category].push(target)
    return acc
  }, {} as Record<string, ScanTarget[]>)

  const categoryLabels: Record<string, string> = {
    temp: 'Temporary Files',
    cache: 'Caches',
    dev: 'Development',
    downloads: 'Downloads',
    other: 'Other'
  }

  const categoryOrder = ['temp', 'cache', 'dev', 'downloads', 'other']

  // Scanning/loading state
  if (mode === 'scanning' || mode === 'csv' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8 text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {mode === 'csv' ? 'Importing CSV...' : 'Scanning...'}
          </h2>
          {scanProgress && (
            <>
              <p className="text-sm text-gray-600 mb-2">
                {scanProgress.current}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(scanProgress.scanned / Math.max(scanProgress.total, 1)) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {scanProgress.scanned} / {scanProgress.total}
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-8">
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to results
          </button>
        )}

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">DiskSage</h1>
          <p className="text-gray-600">Find and safely remove unnecessary files</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Quick Scan Panel */}
          <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">Quick Scan</h2>
              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Recommended</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Scan common cache and temp locations. Fast and finds most cleanable files.
            </p>

            <div className="max-h-48 overflow-y-auto space-y-3 mb-4">
              {categoryOrder.map(category => {
                const categoryTargets = groupedTargets[category]
                if (!categoryTargets || categoryTargets.length === 0) return null

                return (
                  <div key={category}>
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {categoryLabels[category]}
                    </div>
                    {categoryTargets.map(target => (
                      <label
                        key={target.id}
                        className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                          target.exists ? 'hover:bg-blue-100' : 'opacity-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTargets.has(target.id)}
                          onChange={() => toggleTarget(target.id)}
                          disabled={!target.exists}
                          className="mt-0.5 w-4 h-4 rounded border-gray-300"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-800">
                            {target.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {target.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleQuickScan}
              disabled={selectedTargets.size === 0}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Quick Scan
            </button>
          </div>

          {/* CSV Import Panel */}
          <div className="border-2 border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">Import WizTree Export</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              For full drive analysis, export from WizTree and import here.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">How to export from WizTree:</h3>
              <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                <li>Download and run WizTree (free)</li>
                <li>Scan your drive</li>
                <li>File → Export → Export to CSV</li>
                <li>Import the CSV here</li>
              </ol>
            </div>

            <button
              onClick={handleCSVImport}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
            >
              Select CSV File
            </button>
          </div>
        </div>

        {/* Safety note */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-amber-800">
              <strong>Safety first:</strong> DiskSage uses "Test Removal" to rename files before permanent deletion.
              If something breaks, you can instantly undo. Nothing is deleted without your explicit confirmation.
            </div>
          </div>
        </div>

        {displayError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {displayError}
          </div>
        )}
      </div>
    </div>
  )
}
