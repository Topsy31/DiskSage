import { useState, useCallback } from 'react'
import type { FileEntry } from '../types'

interface ImportPanelProps {
  onImport: (entries: FileEntry[]) => void
  isLoading: boolean
  error: string | null
}

export default function ImportPanel({ onImport, isLoading, error }: ImportPanelProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setLocalError(null)

    const files = Array.from(e.dataTransfer.files)
    const csvFile = files.find(f => f.name.endsWith('.csv'))

    if (csvFile) {
      // In Electron with contextIsolation, we can't get the path directly
      // Instead, use the file dialog approach
      setLocalError('Please use the "Browse Files" button to select your CSV file.')
    } else {
      setLocalError('Please drop a CSV file.')
    }
  }, [])

  const handleFileSelect = useCallback(async () => {
    setLocalError(null)

    try {
      // Use Electron's dialog API via IPC
      const filePath = await window.electronAPI.selectCSVFile()

      if (filePath) {
        const entries = await window.electronAPI.parseCSV(filePath)
        if (entries && entries.length > 0) {
          onImport(entries)
        } else {
          setLocalError('No entries found in CSV file. Make sure this is a WizTree export.')
        }
      }
    } catch (err) {
      console.error('Import error:', err)
      setLocalError(err instanceof Error ? err.message : 'Failed to import CSV file')
    }
  }, [onImport])

  const displayError = error || localError

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-xl w-full p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Import WizTree Export
        </h1>
        <p className="text-gray-600 mb-6">
          Export your disk analysis from WizTree as CSV, then import it here.
        </p>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {isLoading ? (
            <div className="space-y-2">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-600">Analysing...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-4xl text-gray-400">
                CSV
              </div>
              <p className="text-gray-600">
                Click the button below to select your WizTree CSV file
              </p>
              <button
                onClick={handleFileSelect}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Files
              </button>
            </div>
          )}
        </div>

        {displayError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {displayError}
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <h3 className="font-medium text-gray-700 mb-2">How to export from WizTree:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open WizTree and scan your drive</li>
            <li>Click File, then Export, then Export to CSV</li>
            <li>Save the file and import it here</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
