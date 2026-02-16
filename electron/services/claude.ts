import Anthropic from '@anthropic-ai/sdk'
import type { FileEntry, Classification, RiskScore, Confidence, AdvisorPlan, AdvisorCategory, SystemAction } from '../../src/types'
import { getClaudeApiKey } from './settingsService'
import { SYSTEM_ACTIONS } from './systemActions'

/**
 * Ask Claude AI about a single file entry.
 * Returns a classification with confidence capped at Medium (per safety model).
 */
export async function askClaudeAI(entry: FileEntry): Promise<Classification> {
  const apiKey = await getClaudeApiKey()

  if (!apiKey) {
    return {
      riskScore: 3,
      confidence: 'low',
      category: 'Unknown',
      recommendation: 'AI analysis not configured - please set up API key in settings',
      explanation: 'To use AI analysis, configure your Claude API key in settings. Until then, use "Research Online" or manually investigate this folder.',
      source: 'ai',
      warnings: []
    }
  }

  const anonymisedPath = anonymisePath(entry.path)
  const prompt = buildItemPrompt(anonymisedPath, entry)

  try {
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return parseClaudeResponse(content.text)
    }

    throw new Error('Unexpected response format from Claude')
  } catch (error) {
    console.error('Claude API error:', error)
    return {
      riskScore: 3,
      confidence: 'low',
      category: 'AI Error',
      recommendation: 'Failed to get AI analysis',
      explanation: error instanceof Error ? error.message : 'Unknown error occurred',
      source: 'ai',
      warnings: []
    }
  }
}

/**
 * Get advisor plan from Claude AI based on full scan summary.
 * Sends anonymised top-50 folders and receives a structured cleanup plan.
 */
export async function getAdvisorPlan(
  entries: FileEntry[],
  totalSize: number
): Promise<AdvisorPlan> {
  const apiKey = await getClaudeApiKey()

  if (!apiKey) {
    throw new Error('Claude API key not configured. Please add your API key in Settings.')
  }

  // Take top 50 folders by size
  const topFolders = [...entries]
    .sort((a, b) => b.size - a.size)
    .slice(0, 50)

  // Anonymise paths
  const anonymisedFolders = topFolders.map(entry => ({
    path: anonymisePath(entry.path),
    size: entry.size,
    modified: entry.modified instanceof Date
      ? entry.modified.toISOString().split('T')[0]
      : String(entry.modified).split('T')[0]
  }))

  const prompt = buildAdvisorPrompt(anonymisedFolders, totalSize, entries.length)

  try {
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return parseAdvisorResponse(content.text, topFolders, totalSize)
    }

    throw new Error('Unexpected response format from Claude')
  } catch (error) {
    console.error('Claude Advisor API error:', error)
    throw error
  }
}

/**
 * Anonymise a path by replacing usernames and project names.
 */
function anonymisePath(path: string): string {
  // Replace username with [USER]
  let anonymised = path.replace(
    /^([A-Z]:\\Users\\)([^\\]+)(\\.*)/i,
    '$1[USER]$3'
  )

  // Replace common project/app names in Documents/Desktop/Downloads
  anonymised = anonymised.replace(
    /\\(Documents|Desktop|Downloads)\\([^\\]+)(\\.*)/gi,
    '\\$1\\[PROJECT]$3'
  )

  return anonymised
}

/**
 * Build the uncertainty-first prompt for single item analysis.
 */
function buildItemPrompt(anonymisedPath: string, entry: FileEntry): string {
  const fileTypes = guessFileTypes(entry)

  return `I'm helping a user understand what's using space on their Windows computer.
I need your help identifying a folder, but please be honest about uncertainty.

Path: ${anonymisedPath}
Size: ${formatSize(entry.size)}
Files: ${entry.files || 'unknown'}
${fileTypes ? `File types: ${fileTypes}` : ''}
Modified: ${entry.modified instanceof Date ? entry.modified.toISOString().split('T')[0] : String(entry.modified).split('T')[0]}

Please respond with:
1. What this MIGHT be (acknowledge if you're uncertain)
2. Confidence level: HIGH (I'm quite sure), MEDIUM (educated guess), or LOW (uncertain)
3. Risk level 1-5 if deleted (1=typically safe, 5=critical)
4. Recommended action with appropriate caveats
5. What could go wrong if this recommendation is incorrect

Be conservative. When in doubt, recommend "investigate further" rather than "delete."`
}

/**
 * Build the advisor prompt for full scan analysis.
 */
function buildAdvisorPrompt(
  folders: Array<{ path: string; size: number; modified: string }>,
  totalSize: number,
  totalCount: number
): string {
  const folderList = folders
    .map((f, i) => `${i + 1}. ${f.path} — ${formatSize(f.size)} (modified: ${f.modified})`)
    .join('\n')

  const actionList = Object.entries(SYSTEM_ACTIONS)
    .map(([id, action]) => `- ${id}: ${action.name} (${action.estimatedSavings})`)
    .join('\n')

  return `You are a disk cleanup advisor for Windows. A user has scanned their disk and needs help identifying cleanup opportunities.

**Scan Summary:**
- Total items analysed: ${totalCount}
- Total size of analysed items: ${formatSize(totalSize)}
- Top 50 folders by size (paths anonymised for privacy):

${folderList}

**Your Task:**
Analyse this scan and provide structured cleanup recommendations. Categorise opportunities into four groups:

**Category A — "DiskSage Can Handle"** (type: "disksage")
Items the user can safely mark for deletion in DiskSage. These are temporary files, caches, and known safe deletions. List specific paths from the scan above with reasons.

**Category B — "System Actions"** (type: "system")
Windows system-level cleanup commands the user should run in PowerShell. Reference ONLY these known action IDs:
${actionList}

Only recommend actions that are relevant to what you see in the scan. For example, only recommend npm-cache-clear if you see npm-related folders.

**Category C — "Investigate"** (type: "investigate")
Unknown large folders or app-specific caches you recognise but that need manual review before deletion. Explain what each likely is and why it needs investigation.

**Category D — "External Tools"** (type: "external")
Things requiring separate tools or actions outside DiskSage (duplicate detection, app uninstalls, etc.). Provide guidance text only.

**Response Format — respond with ONLY this JSON, no other text:**
{
  "summary": "Overall assessment in 2-3 sentences",
  "categories": [
    {
      "type": "disksage",
      "title": "DiskSage Can Handle",
      "description": "Items you can mark for deletion now",
      "items": [
        { "path": "exact path from scan above", "size": size_in_bytes, "reason": "Brief explanation" }
      ]
    },
    {
      "type": "system",
      "title": "System Actions",
      "description": "Commands to run in elevated PowerShell",
      "actions": ["action-id-1", "action-id-2"],
      "guidance": "Brief guidance on running these"
    },
    {
      "type": "investigate",
      "title": "Investigate Further",
      "description": "Needs manual review before deletion",
      "items": [
        { "path": "exact path from scan above", "size": size_in_bytes, "reason": "What this likely is and why to investigate" }
      ]
    },
    {
      "type": "external",
      "title": "External Tools",
      "description": "Actions outside DiskSage",
      "guidance": "Detailed guidance text"
    }
  ]
}

**Important:**
- Use ONLY action IDs from the list above for Category B
- Paths in items must match the anonymised paths provided in the scan
- Be conservative — when uncertain, put items in Category C (Investigate)
- Sizes must be in bytes (numbers, not strings)
- Include only categories that have relevant items — omit empty categories
- Focus on high-impact, low-risk opportunities first`
}

/**
 * Parse Claude's response for single item analysis.
 */
export function parseClaudeResponse(response: string): Classification {
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

/**
 * Parse Claude's response for advisor plan.
 */
function parseAdvisorResponse(
  response: string,
  topFolders: FileEntry[],
  totalSize: number
): AdvisorPlan {
  try {
    // Build a lookup map from anonymised paths back to original paths
    const anonymisedToOriginal = new Map<string, string>()
    for (const entry of topFolders) {
      const anonymised = anonymisePath(entry.path)
      anonymisedToOriginal.set(anonymised.toLowerCase(), entry.path)
    }

    // De-anonymise a path by looking up the original, falling back to the anonymised path
    const deanonymisePath = (anonPath: string): string => {
      // Try exact match first
      const exact = anonymisedToOriginal.get(anonPath.toLowerCase())
      if (exact) return exact

      // Try partial match — the AI might return a parent or child of a scanned path
      for (const [anonKey, originalPath] of anonymisedToOriginal) {
        if (anonPath.toLowerCase().startsWith(anonKey)) return originalPath
        if (anonKey.startsWith(anonPath.toLowerCase())) return originalPath
      }

      return anonPath
    }

    // Extract JSON from response (may be wrapped in markdown code fences)
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                     response.match(/(\{[\s\S]*\})/)

    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const jsonText = jsonMatch[1] || jsonMatch[0]
    const parsed = JSON.parse(jsonText)

    // Map action IDs to full SystemAction objects and build categories
    const categories: AdvisorCategory[] = (parsed.categories || [])
      .map((cat: any) => {
        const category: AdvisorCategory = {
          type: cat.type,
          title: cat.title || '',
          description: cat.description || ''
        }

        if (cat.type === 'system' && cat.actions) {
          category.actions = (cat.actions as string[])
            .map(id => SYSTEM_ACTIONS[id])
            .filter((a): a is SystemAction => a !== undefined)
          category.guidance = cat.guidance
        }

        if (cat.items && Array.isArray(cat.items)) {
          category.items = cat.items.map((item: any) => ({
            path: deanonymisePath(item.path || ''),
            size: typeof item.size === 'number' ? item.size : 0,
            reason: item.reason || ''
          }))
          category.totalSize = category.items!.reduce((sum, item) => sum + item.size, 0)
        }

        if (cat.type === 'external' && cat.guidance) {
          category.guidance = cat.guidance
        }

        return category
      })
      .filter((cat: AdvisorCategory) => {
        // Filter out empty categories
        if (cat.type === 'system') return cat.actions && cat.actions.length > 0
        if (cat.type === 'external') return !!cat.guidance
        if (cat.items) return cat.items.length > 0
        return false
      })

    return {
      categories,
      summary: parsed.summary || 'Analysis complete.',
      createdAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Failed to parse advisor response:', error)
    console.error('Raw response:', response)
    throw new Error('Failed to parse AI response. The AI returned an unexpected format. Please try again.')
  }
}

function extractRecommendation(response: string): string {
  const match = response.match(/recommend(?:ed|ation)?[:\s]*([^.!?]*[.!?])/i)
  return match ? match[1].trim() : 'Investigate before taking action'
}

function guessFileTypes(entry: FileEntry): string | null {
  // Placeholder — would analyse file extensions in the folder
  return null
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}
