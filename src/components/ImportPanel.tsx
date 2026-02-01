import { useState, useCallback } from 'react'
import type { FileEntry } from '../types'

interface ImportPanelProps {
  onImport: (entries: FileEntry[], csvFilePath: string) => void
  isLoading: boolean
  error: string | null
}

export default function ImportPanel({ onImport, isLoading, error }: ImportPanelProps) {
  const [localError, setLocalError] = useState<string | null>(null)
  const [parsingStatus, setParsingStatus] = useState<string | null>(null)

  const handleFileSelect = useCallback(async () => {
    setLocalError(null)
    setParsingStatus(null)

    try {
      const filePath = await window.electronAPI.selectCSVFile()

      if (filePath) {
        setParsingStatus('Reading CSV file...')

        const entries = await window.electronAPI.parseCSV(filePath)

        if (entries && entries.length > 0) {
          setParsingStatus(`Found ${entries.length.toLocaleString()} folders. Analysing...`)
          onImport(entries, filePath)
        } else {
          setLocalError('No entries found in CSV file. Make sure this is a WizTree export.')
          setParsingStatus(null)
        }
      }
    } catch (err) {
      console.error('Import error:', err)
      setLocalError(err instanceof Error ? err.message : 'Failed to import CSV file')
      setParsingStatus(null)
    }
  }, [onImport])

  const displayError = error || localError
  const showLoading = isLoading || parsingStatus

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-xl w-full p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Import WizTree Export
        </h1>
        <p className="text-gray-600 mb-6">
          Export your disk analysis from WizTree as CSV, then import it here.
        </p>

        <div className="border-2 border-gray-200 rounded-lg p-8 text-center bg-gray-50">
          {showLoading ? (
            <div className="space-y-4">
              <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
              <div>
                <p className="text-gray-700 font-medium">
                  {parsingStatus || 'Analysing...'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  This may take a moment for large drives
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-5xl text-gray-300">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600">
                Select your WizTree CSV export file
              </p>
              <button
                onClick={handleFileSelect}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Select CSV File
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
