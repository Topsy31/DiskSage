import { useState, useEffect, useCallback } from 'react'
import type { BackupValidation } from '../types'

interface BackupLocationPanelProps {
  backupLocation: string | null
  onLocationChange: (location: string | null) => void
  requiredBytes: number
  sourcePaths: string[]
  onValidationChange: (validation: BackupValidation | null) => void
}

export default function BackupLocationPanel({
  backupLocation,
  onLocationChange,
  requiredBytes,
  sourcePaths,
  onValidationChange
}: BackupLocationPanelProps) {
  const [validation, setValidation] = useState<BackupValidation | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // Validate backup location when it changes
  useEffect(() => {
    if (!backupLocation || requiredBytes === 0 || sourcePaths.length === 0) {
      setValidation(null)
      onValidationChange(null)
      return
    }

    const validate = async () => {
      setIsValidating(true)
      try {
        const result = await window.electronAPI.validateBackupLocation(
          backupLocation,
          requiredBytes,
          sourcePaths
        )
        setValidation(result)
        onValidationChange(result)
      } catch (err) {
        const errorResult: BackupValidation = {
          isValid: false,
          availableSpace: 0,
          requiredSpace: requiredBytes,
          error: err instanceof Error ? err.message : 'Validation failed'
        }
        setValidation(errorResult)
        onValidationChange(errorResult)
      } finally {
        setIsValidating(false)
      }
    }

    validate()
  }, [backupLocation, requiredBytes, sourcePaths, onValidationChange])

  const handleSelectFolder = useCallback(async () => {
    const path = await window.electronAPI.selectBackupFolder()
    if (path) {
      onLocationChange(path)
      // Save to settings
      await window.electronAPI.setBackupLocation(path)
    }
  }, [onLocationChange])

  const handleClearLocation = useCallback(async () => {
    onLocationChange(null)
    await window.electronAPI.setBackupLocation(null)
    setValidation(null)
    onValidationChange(null)
  }, [onLocationChange, onValidationChange])

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-blue-800 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Backup Location
          </h3>

          {backupLocation ? (
            <div className="mt-2">
              <p className="text-sm text-blue-700 font-mono truncate" title={backupLocation}>
                {backupLocation}
              </p>

              {isValidating && (
                <p className="text-sm text-blue-600 mt-1">Checking available space...</p>
              )}

              {validation && !isValidating && (
                <div className="mt-2">
                  {validation.isValid ? (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-green-700">
                        {formatSize(validation.availableSpace)} available
                        ({formatSize(validation.requiredSpace)} needed)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-sm text-red-700">
                        {validation.error}
                      </span>
                    </div>
                  )}

                  {validation.warning && (
                    <div className="flex items-start gap-2 mt-1 bg-yellow-50 border border-yellow-200 rounded p-2">
                      <svg className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs text-yellow-700">{validation.warning}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-blue-600 mt-1">
              Select a folder to back up files before removal.
              Backups are kept until you manually delete them.
            </p>
          )}
        </div>

        <div className="flex gap-2 ml-4">
          {backupLocation && (
            <button
              onClick={handleClearLocation}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              title="Clear backup location"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleSelectFolder}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {backupLocation ? 'Change' : 'Select Folder'}
          </button>
        </div>
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
