import { useState } from 'react'
import type { RecommendationItem, ProblemReport } from '../types'

interface ReportProblemProps {
  item: RecommendationItem
  onClose: () => void
  onSubmit: (report: ProblemReport) => void
}

type ProblemType = ProblemReport['problemType']

const problemTypes: { value: ProblemType; label: string }[] = [
  { value: 'data-loss', label: 'Recommendation was wrong - caused data loss' },
  { value: 'app-problems', label: 'Recommendation was wrong - caused application problems' },
  { value: 'misidentified', label: 'Folder was misidentified (it\'s actually something else)' },
  { value: 'unclear', label: 'Explanation was confusing or unclear' },
  { value: 'other', label: 'Other' }
]

export default function ReportProblem({ item, onClose, onSubmit }: ReportProblemProps) {
  const [problemType, setProblemType] = useState<ProblemType | null>(null)
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!problemType) return

    setIsSubmitting(true)
    await onSubmit({
      timestamp: new Date().toISOString(),
      path: item.entry.path,
      classification: item.classification,
      problemType,
      details: details || undefined
    })
    setIsSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full shadow-xl">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Report Incorrect Recommendation
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-gray-50 rounded text-sm">
            <div className="font-medium text-gray-700">
              {item.classification.category}
            </div>
            <div className="text-gray-500 truncate">{item.entry.path}</div>
            <div className="text-gray-600 mt-1">
              Our recommendation: {item.classification.recommendation}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What went wrong?
            </label>
            <div className="space-y-2">
              {problemTypes.map(type => (
                <label
                  key={type.value}
                  className="flex items-start gap-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="problemType"
                    value={type.value}
                    checked={problemType === type.value}
                    onChange={() => setProblemType(type.value)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-gray-700">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional details (optional)
            </label>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm resize-none"
              rows={3}
              placeholder="Tell us more about what happened..."
            />
          </div>

          <p className="text-xs text-gray-500">
            This helps improve DiskSage for everyone. No personal data is sent externally.
          </p>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!problemType || isSubmitting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
