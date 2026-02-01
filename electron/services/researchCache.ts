import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import type { WebResearchResult } from '../../src/types'

interface CacheEntry {
  result: WebResearchResult
  expiresAt: string
}

const CACHE_DURATION_DAYS = 7

function getCachePath(): string {
  return path.join(app.getPath('userData'), 'DiskSage', 'research-cache.json')
}

async function loadCache(): Promise<Record<string, CacheEntry>> {
  try {
    const content = await fs.readFile(getCachePath(), 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function saveCache(cache: Record<string, CacheEntry>): Promise<void> {
  const dir = path.dirname(getCachePath())
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(getCachePath(), JSON.stringify(cache, null, 2))
}

/**
 * Get cached research result if valid.
 */
export async function getCache(key: string): Promise<WebResearchResult | null> {
  const cache = await loadCache()
  const entry = cache[key]

  if (!entry) return null

  // Check expiry
  if (new Date(entry.expiresAt) < new Date()) {
    delete cache[key]
    await saveCache(cache)
    return null
  }

  return entry.result
}

/**
 * Store research result in cache.
 */
export async function setCache(key: string, result: WebResearchResult): Promise<void> {
  const cache = await loadCache()

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + CACHE_DURATION_DAYS)

  cache[key] = {
    result,
    expiresAt: expiresAt.toISOString()
  }

  await saveCache(cache)
}

/**
 * Clear all cached research.
 */
export async function clearCache(): Promise<void> {
  await saveCache({})
}

/**
 * Remove expired entries from cache.
 */
export async function pruneCache(): Promise<number> {
  const cache = await loadCache()
  const now = new Date()
  let removed = 0

  for (const key of Object.keys(cache)) {
    if (new Date(cache[key].expiresAt) < now) {
      delete cache[key]
      removed++
    }
  }

  if (removed > 0) {
    await saveCache(cache)
  }

  return removed
}
