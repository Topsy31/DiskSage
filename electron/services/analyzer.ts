import type { FileEntry, Classification, RecommendationItem, PathWarning } from '../../src/types'
import { findMatchingRule } from './rules'
import { validatePath, isOneDrivePath } from './pathValidator'

/**
 * Analyze a list of file entries and return recommendations.
 * This is the core analysis engine that combines rules with path validation.
 */
export async function analyzeEntries(
  entries: FileEntry[],
  _sessionId: string
): Promise<RecommendationItem[]> {
  const recommendations: RecommendationItem[] = []

  for (const entry of entries) {
    const classification = await classifyEntry(entry)
    recommendations.push({
      entry,
      classification,
      potentialSavings: entry.size
    })
  }

  // Sort by size descending (largest first)
  recommendations.sort((a, b) => b.entry.size - a.entry.size)

  return recommendations
}

/**
 * Classify a single file entry.
 */
async function classifyEntry(entry: FileEntry): Promise<Classification> {
  const warnings: PathWarning[] = []

  // First, validate the path for special conditions
  const validation = await validatePath(entry.path).catch(() => ({
    isValid: true,
    warnings: [],
    resolvedPath: entry.path
  }))

  warnings.push(...validation.warnings)

  // Check for OneDrive (even if validatePath didn't catch it)
  if (isOneDrivePath(entry.path) && !warnings.some(w => w.type === 'onedrive')) {
    warnings.push({
      type: 'onedrive',
      message: 'This folder syncs with OneDrive. Deleting here will also delete from the cloud.'
    })
  }

  // Try to find a matching rule
  const rule = findMatchingRule(entry.path)

  if (rule) {
    return {
      riskScore: rule.riskScore,
      confidence: rule.confidence,
      category: rule.category,
      recommendation: rule.recommendation,
      explanation: rule.explanation,
      source: 'offline-rule',
      ruleId: rule.id,
      warnings
    }
  }

  // No matching rule - return unknown classification
  return {
    riskScore: 3, // Medium risk for unknown
    confidence: 'low',
    category: 'Unknown',
    recommendation: 'Needs investigation - unknown folder',
    explanation: 'This folder was not recognised by our rules. Use "Ask AI" or "Research Online" to learn more before taking action.',
    source: 'offline-rule',
    warnings
  }
}

/**
 * Get display text for a classification based on risk and confidence.
 * Uses conservative language throughout.
 */
export function getDisplayRecommendation(
  riskScore: number,
  confidence: 'high' | 'medium' | 'low'
): string {
  // Low confidence always downgrades
  if (confidence === 'low') {
    if (riskScore >= 4) {
      return 'Unknown - do not delete'
    }
    return 'Unknown - investigate before taking action'
  }

  // Risk-based recommendations
  if (riskScore === 1) {
    return confidence === 'high'
      ? 'Typically safe - temporary files that rebuild automatically'
      : 'Probably safe - but verify these are not files you created'
  }

  if (riskScore === 2) {
    return confidence === 'high'
      ? 'Usually safe - can be recreated if needed'
      : 'Probably safe - review contents first'
  }

  if (riskScore === 3) {
    return 'Review required - could contain important data'
  }

  if (riskScore === 4) {
    return 'Backup first - likely contains personal files'
  }

  // Risk 5
  return 'Do not delete - system or application files'
}

/**
 * Filter recommendations by risk and confidence.
 */
export function filterRecommendations(
  recommendations: RecommendationItem[],
  options: {
    maxRisk?: number
    minConfidence?: 'high' | 'medium' | 'low'
    showUnknown?: boolean
  }
): RecommendationItem[] {
  const confidenceOrder = { high: 3, medium: 2, low: 1 }
  const minConfidenceValue = options.minConfidence
    ? confidenceOrder[options.minConfidence]
    : 0

  return recommendations.filter(rec => {
    const { riskScore, confidence, category } = rec.classification

    // Filter by risk
    if (options.maxRisk !== undefined && riskScore > options.maxRisk) {
      return false
    }

    // Filter by confidence
    if (confidenceOrder[confidence] < minConfidenceValue) {
      return false
    }

    // Filter unknown
    if (!options.showUnknown && category === 'Unknown') {
      return false
    }

    return true
  })
}

/**
 * Calculate total potential savings from recommendations.
 */
export function calculateTotalSavings(recommendations: RecommendationItem[]): number {
  return recommendations
    .filter(r => r.classification.riskScore <= 2 && r.classification.confidence !== 'low')
    .reduce((sum, r) => sum + r.potentialSavings, 0)
}
