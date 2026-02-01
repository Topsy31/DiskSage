import { useState } from 'react'

interface SafetyIntroProps {
  onConfirm: () => void
}

export default function SafetyIntro({ onConfirm }: SafetyIntroProps) {
  const [hasBackup, setHasBackup] = useState(false)
  const [understandsVerify, setUnderstandsVerify] = useState(false)

  const canContinue = hasBackup && understandsVerify

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-xl w-full p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          DiskSage
        </h1>

        <div className="space-y-6">
          <p className="text-gray-700">
            Before we start, a few important things:
          </p>

          <div className="space-y-4">
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
              <h3 className="font-semibold text-amber-800 mb-2">
                1. BACKUP FIRST
              </h3>
              <p className="text-amber-700 text-sm">
                When did you last back up your important files?
                DiskSage provides guidance, not guarantees.
              </p>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              <h3 className="font-semibold text-blue-800 mb-2">
                2. YOU DECIDE
              </h3>
              <p className="text-blue-700 text-sm">
                DiskSage will never delete anything. You review
                recommendations and act in File Explorer.
              </p>
            </div>

            <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
              <h3 className="font-semibold text-gray-800 mb-2">
                3. WHEN IN DOUBT, DON'T
              </h3>
              <p className="text-gray-700 text-sm">
                If a recommendation doesn't feel right, skip it.
                It's better to keep something than lose it.
              </p>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasBackup}
                onChange={e => setHasBackup(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                I have a recent backup of my important files
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={understandsVerify}
                onChange={e => setUnderstandsVerify(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                I understand I should verify before deleting anything
              </span>
            </label>
          </div>

          <button
            onClick={onConfirm}
            disabled={!canContinue}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              canContinue
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
