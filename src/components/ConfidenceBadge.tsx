import type { Confidence } from '../types'

interface ConfidenceBadgeProps {
  confidence: Confidence
}

const confidenceConfig: Record<Confidence, { label: string; color: string; bgColor: string }> = {
  high: { label: 'High', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  medium: { label: 'Medium', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  low: { label: 'Low', color: 'text-gray-700', bgColor: 'bg-gray-200' }
}

export default function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const config = confidenceConfig[confidence]

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
      Conf: {config.label}
    </span>
  )
}
