import fs from 'fs/promises'
import path from 'path'
import type { RemovalTestItem, RemovalTestJob, FileEntry } from '../../src/types'
import { saveTestState, loadTestState, clearTestState, updateTestState } from './removalState'
import { logOperation } from './removalLogger'
import { copyToBackup } from './backupService'

const BACKUP_SUFFIX = '.disksage-backup'

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Rename items to make them inaccessible (append .disksage-backup)
 * Optionally backs up items to a specified location first.
 *
 * SAFETY: Manifest is written BEFORE any renames occur, so if the system
 * crashes mid-operation, the manifest can be used to restore from Safe Mode.
 */
export async function disableItems(
  entries: FileEntry[],
  backupLocation?: string
): Promise<RemovalTestJob> {
  const jobId = generateJobId()

  // Pre-compute all rename paths
  const items: RemovalTestItem[] = entries.map(entry => ({
    entry,
    included: true,
    originalPath: entry.path,
    renamedPath: entry.path + BACKUP_SUFFIX,
    status: 'pending' as const
  }))

  // Calculate total bytes
  const totalBytes = entries.reduce((sum, e) => sum + e.size, 0)

  // Create job with all planned renames
  const job: RemovalTestJob = {
    jobId,
    items,
    phase: 'testing',
    createdAt: new Date().toISOString(),
    totalBytes,
    backupLocation
  }

  // CRITICAL: Save manifest BEFORE any operations
  // This ensures we can recover even if the system crashes mid-operation
  await saveTestState(job)

  // Process each item: backup (if location provided), then rename
  for (const item of items) {
    try {
      // Check if source exists
      await fs.access(item.originalPath)

      // Step 1: Copy to backup location (if provided)
      if (backupLocation) {
        const backupResult = await copyToBackup(item.originalPath, backupLocation, jobId)

        if (!backupResult.success) {
          item.status = 'failed'
          item.error = `Backup failed: ${backupResult.error}`
          await updateTestState(job)
          await logOperation('backup', item.originalPath, undefined, 'failed', item.error)
          continue
        }

        item.backupPath = backupResult.backupPath
        await logOperation('backup', item.originalPath, item.backupPath, 'success')
      }

      // Step 2: Check if rename target already exists (don't overwrite)
      try {
        await fs.access(item.renamedPath!)
        item.status = 'failed'
        item.error = 'Rename target already exists'
        await updateTestState(job)
        continue
      } catch {
        // Target doesn't exist, good to proceed
      }

      // Step 3: Rename the folder/file
      await fs.rename(item.originalPath, item.renamedPath!)

      item.status = 'renamed'

      // Update manifest after each successful operation
      await updateTestState(job)

      await logOperation('disable', item.originalPath, item.renamedPath!, 'success')
    } catch (err) {
      item.status = 'failed'
      item.error = err instanceof Error ? err.message : 'Unknown error'
      await updateTestState(job)
      await logOperation('disable', item.originalPath, undefined, 'failed', item.error)
    }
  }

  return job
}

/**
 * Restore items by renaming back to original
 */
export async function restoreItems(job: RemovalTestJob): Promise<RemovalTestJob> {
  for (const item of job.items) {
    if (item.status !== 'renamed' || !item.renamedPath) {
      continue
    }

    try {
      // Check if renamed path still exists
      await fs.access(item.renamedPath)

      // Check if original path is now occupied (app recreated it)
      try {
        await fs.access(item.originalPath)
        item.status = 'failed'
        item.error = 'Original path now exists (may have been recreated by an application)'
        continue
      } catch {
        // Original path is free, good to proceed
      }

      // Rename back
      await fs.rename(item.renamedPath, item.originalPath)

      item.status = 'restored'
      item.renamedPath = undefined

      await logOperation('restore', item.originalPath, undefined, 'success')
    } catch (err) {
      item.status = 'failed'
      item.error = err instanceof Error ? err.message : 'Unknown error'
      await logOperation('restore', item.originalPath, item.renamedPath, 'failed', item.error)
    }
  }

  // Clear persisted state since test is complete
  await clearTestState()

  return {
    ...job,
    phase: 'selecting',
    completedAt: new Date().toISOString()
  }
}

/**
 * Permanently delete the renamed items
 */
export async function deleteDisabledItems(
  job: RemovalTestJob
): Promise<{ deleted: number; bytesFreed: number; failed: RemovalTestItem[] }> {
  let deleted = 0
  let bytesFreed = 0
  const failed: RemovalTestItem[] = []

  for (const item of job.items) {
    if (item.status !== 'renamed' || !item.renamedPath) {
      continue
    }

    try {
      // Check if renamed path still exists
      await fs.access(item.renamedPath)

      // Delete recursively
      await fs.rm(item.renamedPath, { recursive: true, force: true })

      item.status = 'deleted'
      deleted++
      bytesFreed += item.entry.size

      await logOperation('delete', item.renamedPath, undefined, 'success')
    } catch (err) {
      item.status = 'failed'
      item.error = err instanceof Error ? err.message : 'Unknown error'
      failed.push(item)
      await logOperation('delete', item.renamedPath || item.originalPath, undefined, 'failed', item.error)
    }
  }

  // Clear persisted state since test is complete
  await clearTestState()

  return { deleted, bytesFreed, failed }
}

/**
 * Restore a single item by renaming back to original
 */
export async function restoreSingleItem(
  job: RemovalTestJob,
  originalPath: string
): Promise<RemovalTestJob> {
  const item = job.items.find(
    i => i.originalPath.toLowerCase() === originalPath.toLowerCase()
  )

  if (!item || item.status !== 'renamed' || !item.renamedPath) {
    throw new Error(`Item not found or not in 'renamed' state: ${originalPath}`)
  }

  try {
    await fs.access(item.renamedPath)

    // Check if original path is now occupied (app recreated it)
    try {
      await fs.access(item.originalPath)
      item.status = 'failed'
      item.error = 'Original path now exists (may have been recreated by an application)'
      await updateTestState(job)
      await logOperation('restore', item.originalPath, undefined, 'failed', item.error)
      return job
    } catch {
      // Original path is free, good to proceed
    }

    await fs.rename(item.renamedPath, item.originalPath)
    item.status = 'restored'
    item.renamedPath = undefined
    await logOperation('restore', item.originalPath, undefined, 'success')
  } catch (err) {
    item.status = 'failed'
    item.error = err instanceof Error ? err.message : 'Unknown error'
    await logOperation('restore', item.originalPath, item.renamedPath, 'failed', item.error)
  }

  // Check if test is complete (no more 'renamed' items)
  const hasRemainingRenamed = job.items.some(i => i.status === 'renamed')
  if (!hasRemainingRenamed) {
    await clearTestState()
    return { ...job, phase: 'confirmed', completedAt: new Date().toISOString() }
  }

  await updateTestState(job)
  return job
}

/**
 * Permanently delete a single disabled item
 */
export async function deleteSingleItem(
  job: RemovalTestJob,
  originalPath: string
): Promise<RemovalTestJob> {
  const item = job.items.find(
    i => i.originalPath.toLowerCase() === originalPath.toLowerCase()
  )

  if (!item || item.status !== 'renamed' || !item.renamedPath) {
    throw new Error(`Item not found or not in 'renamed' state: ${originalPath}`)
  }

  try {
    await fs.access(item.renamedPath)
    await fs.rm(item.renamedPath, { recursive: true, force: true })
    item.status = 'deleted'
    await logOperation('delete', item.renamedPath, undefined, 'success')
  } catch (err) {
    item.status = 'failed'
    item.error = err instanceof Error ? err.message : 'Unknown error'
    await logOperation('delete', item.renamedPath || item.originalPath, undefined, 'failed', item.error)
  }

  // Check if test is complete (no more 'renamed' items)
  const hasRemainingRenamed = job.items.some(i => i.status === 'renamed')
  if (!hasRemainingRenamed) {
    await clearTestState()
    return { ...job, phase: 'confirmed', completedAt: new Date().toISOString() }
  }

  await updateTestState(job)
  return job
}

/**
 * Get the current active test (if any)
 */
export async function getActiveTest(): Promise<RemovalTestJob | null> {
  const state = await loadTestState()

  if (!state) {
    return null
  }

  // Verify items still exist in their renamed state
  for (const item of state.items) {
    if (item.status === 'renamed' && item.renamedPath) {
      try {
        await fs.access(item.renamedPath)
      } catch {
        // Item no longer exists, mark as failed
        item.status = 'failed'
        item.error = 'Renamed file no longer exists'
      }
    }
  }

  return state
}
