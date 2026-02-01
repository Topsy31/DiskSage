import type { RiskScore } from '../types'

interface RiskBadgeProps {
  score: RiskScore
}

const riskConfig: Record<RiskScore, { label: string; color: string; bgColor: string }> = {
  1: { label: 'Low', color: 'text-green-700', bgColor: 'bg-green-100' },
  2: { label: 'Low-Med', color: 'text-lime-700', bgColor: 'bg-lime-100' },
  3: { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  4: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  5: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-100' }
}

export default function RiskBadge({ score }: RiskBadgeProps) {
  const config = riskConfig[score]

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
      Risk: {config.label}
    </span>
  )
}

// Visual indicator with dots
export function RiskIndicator({ score }: RiskBadgeProps) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${
            i <= score
              ? score <= 2 ? 'bg-green-500'
                : score === 3 ? 'bg-yellow-500'
                : score === 4 ? 'bg-orange-500'
                : 'bg-red-500'
              : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}
