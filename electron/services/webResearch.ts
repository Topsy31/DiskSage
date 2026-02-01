import type { WebResearchResult, SourceResult } from '../../src/types'
import { getCache, setCache } from './researchCache'

// Trusted domains with their weights
const TRUSTED_DOMAINS = [
  { domain: 'docs.microsoft.com', trustLevel: 'official' as const, weight: 3 },
  { domain: 'learn.microsoft.com', trustLevel: 'official' as const, weight: 3 },
  { domain: 'support.microsoft.com', trustLevel: 'official' as const, weight: 3 },
  { domain: 'answers.microsoft.com', trustLevel: 'official' as const, weight: 2 },
  { domain: 'superuser.com', trustLevel: 'community' as const, weight: 2 },
  { domain: 'serverfault.com', trustLevel: 'community' as const, weight: 2 },
  { domain: 'bleepingcomputer.com', trustLevel: 'expert' as const, weight: 2 },
  { domain: 'howtogeek.com', trustLevel: 'expert' as const, weight: 1 },
  { domain: 'tenforums.com', trustLevel: 'community' as const, weight: 1 }
]

// Edge case detection patterns
const EDGE_CASE_PATTERNS = [
  /but be careful if/i,
  /exception when/i,
  /do not delete if/i,
  /may cause issues with/i,
  /only safe if/i,
  /make sure first/i,
  /however,?\s+if/i,
  /unless you/i,
  /before deleting,?\s+ensure/i,
  /warning:/i
]

// Sentiment detection patterns
const SAFE_PATTERNS = [
  /safe to delete/i,
  /can be safely/i,
  /you can delete/i,
  /okay to remove/i,
  /free to delete/i
]

const DANGER_PATTERNS = [
  /do not delete/i,
  /don't delete/i,
  /never delete/i,
  /should not delete/i,
  /will break/i,
  /will cause/i,
  /required by/i,
  /needed for/i
]

/**
 * Perform web research on a folder path.
 * Uses curated sources and returns consensus with edge cases.
 */
export async function webResearch(folderPath: string): Promise<WebResearchResult> {
  // Extract folder name for search
  const folderName = extractFolderName(folderPath)

  // Check cache first
  const cacheKey = folderName.toLowerCase()
  const cached = await getCache(cacheKey)
  if (cached) {
    return cached
  }

  // Build search query
  const siteRestrictions = TRUSTED_DOMAINS
    .slice(0, 5) // Use top 5 trusted domains
    .map(d => `site:${d.domain}`)
    .join(' OR ')

  const query = `"${folderName}" safe to delete Windows ${siteRestrictions}`

  // In a real implementation, this would call a search API
  // For now, we return a placeholder that the UI can handle
  const result: WebResearchResult = {
    query,
    sources: [],
    consensus: 'insufficient',
    edgeCases: [],
    confidenceAdjustment: 0,
    summary: 'Web research is not yet connected to a search API. This feature requires integration with a web search service.',
    cachedAt: new Date().toISOString()
  }

  // Cache the result
  await setCache(cacheKey, result)

  return result
}

/**
 * Extract folder name from path for searching.
 */
function extractFolderName(path: string): string {
  const parts = path.split('\\').filter(p => p)

  // For system folders, use last 2 parts for context
  if (path.toLowerCase().includes('\\windows\\')) {
    const windowsIndex = parts.findIndex(p => p.toLowerCase() === 'windows')
    if (windowsIndex >= 0 && windowsIndex < parts.length - 1) {
      return parts.slice(windowsIndex).join(' ')
    }
  }

  // For AppData, use app name
  if (path.toLowerCase().includes('\\appdata\\')) {
    const appDataIndex = parts.findIndex(p => p.toLowerCase() === 'appdata')
    if (appDataIndex >= 0 && appDataIndex < parts.length - 2) {
      return parts.slice(appDataIndex + 2, appDataIndex + 4).join(' ')
    }
  }

  // Default: last part
  return parts[parts.length - 1] || path
}

/**
 * Detect sentiment from text snippet.
 */
export function detectSentiment(text: string): 'safe' | 'dangerous' | 'conditional' | 'neutral' {
  const hasSafe = SAFE_PATTERNS.some(p => p.test(text))
  const hasDanger = DANGER_PATTERNS.some(p => p.test(text))
  const hasEdgeCase = EDGE_CASE_PATTERNS.some(p => p.test(text))

  if (hasSafe && hasDanger) return 'conditional'
  if (hasEdgeCase) return 'conditional'
  if (hasSafe) return 'safe'
  if (hasDanger) return 'dangerous'
  return 'neutral'
}

/**
 * Extract edge cases from text.
 */
export function extractEdgeCases(text: string): string[] {
  const edgeCases: string[] = []

  for (const pattern of EDGE_CASE_PATTERNS) {
    const match = text.match(new RegExp(`(${pattern.source}[^.!?]*[.!?])`, 'gi'))
    if (match) {
      edgeCases.push(...match.map(m => m.trim()))
    }
  }

  return [...new Set(edgeCases)] // Deduplicate
}

/**
 * Calculate consensus from sources.
 */
export function calculateConsensus(sources: SourceResult[]): {
  consensus: WebResearchResult['consensus']
  adjustment: -1 | 0 | 1
} {
  if (sources.length < 2) {
    return { consensus: 'insufficient', adjustment: 0 }
  }

  let safeWeight = 0
  let dangerWeight = 0

  for (const source of sources) {
    const config = TRUSTED_DOMAINS.find(d => source.domain.includes(d.domain))
    const weight = config?.weight || 1

    if (source.sentiment === 'safe') safeWeight += weight
    if (source.sentiment === 'dangerous') dangerWeight += weight
  }

  const hasEdgeCases = sources.some(s => s.warnings && s.warnings.length > 0)

  if (safeWeight > 0 && dangerWeight > 0) {
    return { consensus: 'conflicting', adjustment: -1 }
  }

  if (hasEdgeCases) {
    return { consensus: 'conditional', adjustment: 0 }
  }

  if (safeWeight > dangerWeight * 2) {
    return { consensus: 'safe', adjustment: 1 }
  }

  if (dangerWeight > safeWeight * 2) {
    return { consensus: 'dangerous', adjustment: 0 }
  }

  return { consensus: 'conditional', adjustment: 0 }
}
