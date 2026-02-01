import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import type { RemovalTestJob } from '../../src/types'

/**
 * Get the path to the state file
 */
function getStatePath(): string {
  const appDataPath = app.getPath('userData')
  return path.join(appDataPath, 'removal-tests.json')
}

/**
 * Ensure the app data directory exists
 */
async function ensureDir(): Promise<void> {
  const dir = path.dirname(getStatePath())
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Save the current test state (initial write before renames)
 */
export async function saveTestState(job: RemovalTestJob): Promise<void> {
  await ensureDir()
  const statePath = getStatePath()

  const state = {
    activeTest: job,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString()
  }

  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8')
}

/**
 * Update the test state after each rename operation
 * This ensures the manifest always reflects the current state
 */
export async function updateTestState(job: RemovalTestJob): Promise<void> {
  const statePath = getStatePath()

  const state = {
    activeTest: job,
    lastUpdatedAt: new Date().toISOString()
  }

  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8')
}

/**
 * Load the current test state (if any)
 */
export async function loadTestState(): Promise<RemovalTestJob | null> {
  const statePath = getStatePath()

  try {
    const content = await fs.readFile(statePath, 'utf-8')
    const state = JSON.parse(content)

    if (state.activeTest && state.activeTest.phase === 'testing') {
      return state.activeTest as RemovalTestJob
    }

    return null
  } catch {
    // File doesn't exist or is invalid
    return null
  }
}

/**
 * Clear the test state (after restore or delete)
 */
export async function clearTestState(): Promise<void> {
  const statePath = getStatePath()

  try {
    await fs.unlink(statePath)
  } catch {
    // File doesn't exist, that's fine
  }
}
