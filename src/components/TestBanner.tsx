import { useState } from 'react'
import type { RemovalTestJob } from '../types'

interface TestBannerProps {
  job: RemovalTestJob
  onUndo: () => void
  onConfirmDelete: () => void
  isLoading: boolean
}

export default function TestBanner({
  job,
  onUndo,
  onConfirmDelete,
  isLoading
}: TestBannerProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const renamedItems = job.items.filter(i => i.status === 'renamed')
  const failedItems = job.items.filter(i => i.status === 'failed')

  if (renamedItems.length === 0) {
    return null
  }

  return (
    <>
      <div className="bg-amber-50 border-b-2 border-amber-400 px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-amber-800">
                Testing Removal: {renamedItems.length} items disabled ({formatSize(job.totalBytes)})
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Use your system normally. If something breaks, click Undo to restore instantly.
              </p>
              {failedItems.length > 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  {failedItems.length} item(s) could not be renamed
                </p>
              )}
              <p className="text-xs text-amber-600 mt-2">
                Started: {new Date(job.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={onUndo}
              disabled={isLoading}
              className="px-4 py-2 bg-white border border-amber-400 text-amber-700 rounded-lg font-medium hover:bg-amber-50 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Restoring...' : 'Undo All'}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Confirm & Delete
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Permanently Delete?
                </h2>
              </div>

              <p className="text-gray-600 mb-4">
                This will permanently delete {renamedItems.length} folder(s) totalling {formatSize(job.totalBytes)}.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700 font-medium">
                  This cannot be undone.
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Make sure your system is working correctly before proceeding.
                </p>
              </div>

              <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-2 text-sm text-gray-600">
                {renamedItems.map(item => (
                  <div key={item.originalPath} className="truncate py-0.5" title={item.originalPath}>
                    {item.originalPath}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  onConfirmDelete()
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}
