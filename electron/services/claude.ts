import type { FileEntry, Classification, RiskScore, Confidence } from '../../src/types'

/**
 * Ask Claude AI about a file entry.
 * Returns a classification with confidence capped at Medium (per safety model).
 */
export async function askClaudeAI(entry: FileEntry): Promise<Classification> {
  // Anonymise the path before sending
  const anonymisedPath = anonymisePath(entry.path)

  // Build the prompt using uncertainty-first approach
  const prompt = buildPrompt(anonymisedPath, entry)

  // In a real implementation, this would call the Claude API
  // For now, return a placeholder that indicates AI is not configured
  return {
    riskScore: 3,
    confidence: 'low', // AI responses capped at Medium, but unconnected = Low
    category: 'Unknown',
    recommendation: 'AI analysis not configured - please set up API key',
    explanation: 'To use AI analysis, configure your Claude API key in settings. Until then, use "Research Online" or manually investigate this folder.',
    source: 'ai',
    warnings: []
  }
}

/**
 * Anonymise a path by hashing usernames and project names.
 */
function anonymisePath(path: string): string {
  // Replace username with [USER]
  let anonymised = path.replace(
    /^([A-Z]:\\Users\\)([^\\]+)(\\.*)/i,
    '$1[USER]$3'
  )

  // Replace common project/app names
  anonymised = anonymised.replace(
    /\\(Documents|Desktop|Downloads)\\([^\\]+)(\\.*)/gi,
    '\\$1\\[PROJECT]$3'
  )

  return anonymised
}

/**
 * Build the uncertainty-first prompt for Claude.
 */
function buildPrompt(anonymisedPath: string, entry: FileEntry): string {
  const fileTypes = guessFileTypes(entry)

  return `I'm helping a user understand what's using space on their Windows computer.
I need your help identifying a folder, but please be honest about uncertainty.

Path: ${anonymisedPath}
Size: ${formatSize(entry.size)}
Files: ${entry.files || 'unknown'}
${fileTypes ? `File types: ${fileTypes}` : ''}
Modified: ${entry.modified.toISOString().split('T')[0]}

Please respond with:
1. What this MIGHT be (acknowledge if you're uncertain)
2. Confidence level: HIGH (I'm quite sure), MEDIUM (educated guess), or LOW (uncertain)
3. Risk level 1-5 if deleted (1=typically safe, 5=critical)
4. Recommended action with appropriate caveats
5. What could go wrong if this recommendation is incorrect

Be conservative. When in doubt, recommend "investigate further" rather than "delete."`
}

/**
 * Parse Claude's response into a classification.
 */
export function parseClaudeResponse(response: string): Classification {
  // This would parse the structured response from Claude
  // For now, return a safe default

  // Extract confidence (cap at Medium per safety model)
  let confidence: Confidence = 'medium'
  if (response.toLowerCase().includes('low') || response.toLowerCase().includes('uncertain')) {
    confidence = 'low'
  }

  // Extract risk score
  let riskScore: RiskScore = 3
  const riskMatch = response.match(/risk\s*(?:level)?:?\s*(\d)/i)
  if (riskMatch) {
    const parsed = parseInt(riskMatch[1]) as RiskScore
    if (parsed >= 1 && parsed <= 5) {
      riskScore = parsed
    }
  }

  return {
    riskScore,
    confidence,
    category: 'AI Analysis',
    recommendation: 'AI suggests: ' + extractRecommendation(response),
    explanation: response,
    source: 'ai',
    warnings: []
  }
}

function extractRecommendation(response: string): string {
  // Extract the recommendation section
  const match = response.match(/recommend(?:ed|ation)?[:\s]*([^.!?]*[.!?])/i)
  return match ? match[1].trim() : 'Investigate before taking action'
}

function guessFileTypes(entry: FileEntry): string | null {
  // This would analyze file extensions in the folder
  // For now, return null
  return null
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}
