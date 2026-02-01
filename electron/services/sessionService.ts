import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import type { FileEntry, RecommendationItem } from '../../src/types'

interface SessionData {
  csvFilePath: string
  entries: FileEntry[]
  recommendations: RecommendationItem[]
  markedPaths?: string[]
  savedAt: string
}

/**
 * Get the path to the session file
 */
function getSessionPath(): string {
  const appDataPath = app.getPath('userData')
  return path.join(appDataPath, 'session.json')
}

/**
 * Ensure the app data directory exists
 */
async function ensureDir(): Promise<void> {
  const dir = path.dirname(getSessionPath())
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Save the current session (imported data)
 */
export async function saveSession(
  csvFilePath: string,
  entries: FileEntry[],
  recommendations: RecommendationItem[],
  markedPaths?: string[]
): Promise<void> {
  await ensureDir()
  const sessionPath = getSessionPath()

  const session: SessionData = {
    csvFilePath,
    entries,
    recommendations,
    markedPaths,
    savedAt: new Date().toISOString()
  }

  await fs.writeFile(sessionPath, JSON.stringify(session), 'utf-8')
}

/**
 * Load the previous session (if any)
 */
export async function loadSession(): Promise<SessionData | null> {
  const sessionPath = getSessionPath()

  try {
    const content = await fs.readFile(sessionPath, 'utf-8')
    const session = JSON.parse(content) as SessionData

    // Convert date strings back to Date objects
    for (const entry of session.entries) {
      entry.modified = new Date(entry.modified)
    }
    for (const rec of session.recommendations) {
      rec.entry.modified = new Date(rec.entry.modified)
    }

    return session
  } catch {
    return null
  }
}

/**
 * Clear the session
 */
export async function clearSession(): Promise<void> {
  const sessionPath = getSessionPath()

  try {
    await fs.unlink(sessionPath)
  } catch {
    // File doesn't exist, that's fine
  }
}
