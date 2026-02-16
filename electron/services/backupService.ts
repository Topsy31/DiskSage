import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface DiskSpaceInfo {
  available: number
  total: number
  used: number
}

export interface BackupValidation {
  isValid: boolean
  availableSpace: number
  requiredSpace: number
  warning?: string
  error?: string
}

/**
 * Get available disk space for a given path (Windows-specific)
 */
export async function getAvailableDiskSpace(targetPath: string): Promise<number> {
  try {
    // Ensure path exists
    await fs.access(targetPath)

    // Get drive letter from path
    const driveLetter = targetPath.split('\\')[0] || targetPath.split('/')[0]

    // Use WMIC to get disk space (works on Windows)
    const { stdout } = await execAsync(
      `wmic logicaldisk where "DeviceID='${driveLetter}'" get FreeSpace /format:value`
    )

    // Parse the output
    const match = stdout.match(/FreeSpace=(\d+)/)
    if (match && match[1]) {
      return parseInt(match[1], 10)
    }

    throw new Error('Could not parse disk space')
  } catch (err) {
    // Fallback: try PowerShell
    try {
      const driveLetter = targetPath.split('\\')[0] || targetPath.split('/')[0]
      const { stdout } = await execAsync(
        `powershell -command "(Get-PSDrive ${driveLetter.replace(':', '')}).Free"`
      )
      const bytes = parseInt(stdout.trim(), 10)
      if (!isNaN(bytes)) {
        return bytes
      }
    } catch {
      // Ignore fallback errors
    }

    throw new Error(`Cannot determine disk space for ${targetPath}: ${err}`)
  }
}

/**
 * Get drive letter from a path
 */
export function getDriveLetter(filePath: string): string {
  const normalized = path.normalize(filePath)
  const match = normalized.match(/^([A-Za-z]:)/)
  return match ? match[1].toUpperCase() : ''
}

/**
 * Check if two paths are on the same drive
 */
export function isSameDrive(path1: string, path2: string): boolean {
  return getDriveLetter(path1) === getDriveLetter(path2)
}

/**
 * Validate backup location for a given set of files
 */
export async function validateBackupLocation(
  backupPath: string,
  requiredBytes: number,
  sourcePaths: string[]
): Promise<BackupValidation> {
  try {
    // Check path exists and is writable
    try {
      await fs.access(backupPath, fs.constants.W_OK)
    } catch {
      return {
        isValid: false,
        availableSpace: 0,
        requiredSpace: requiredBytes,
        error: 'Backup location does not exist or is not writable'
      }
    }

    // Check available space
    const availableSpace = await getAvailableDiskSpace(backupPath)

    // Add 5% overhead margin
    const requiredWithMargin = Math.ceil(requiredBytes * 1.05)

    if (availableSpace < requiredWithMargin) {
      return {
        isValid: false,
        availableSpace,
        requiredSpace: requiredBytes,
        error: `Insufficient space. Need ${formatSize(requiredWithMargin)}, have ${formatSize(availableSpace)}`
      }
    }

    // Check if any source is on the same drive
    const sameDrive = sourcePaths.some(p => isSameDrive(p, backupPath))
    if (sameDrive) {
      return {
        isValid: true,
        availableSpace,
        requiredSpace: requiredBytes,
        warning: 'Backup location is on the same drive as some files. This provides recovery but does not protect against drive failure.'
      }
    }

    return {
      isValid: true,
      availableSpace,
      requiredSpace: requiredBytes
    }
  } catch (err) {
    return {
      isValid: false,
      availableSpace: 0,
      requiredSpace: requiredBytes,
      error: `Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    }
  }
}

/**
 * Copy a file or directory to backup location
 * Returns the backup path where the item was copied
 */
export async function copyToBackup(
  sourcePath: string,
  backupLocation: string,
  jobId: string
): Promise<{ success: boolean; backupPath: string; error?: string }> {
  try {
    // Create job-specific backup folder
    const jobFolder = path.join(backupLocation, `DiskSage-${jobId}`)
    await fs.mkdir(jobFolder, { recursive: true })

    // Preserve original folder structure relative to drive root
    const driveLetter = getDriveLetter(sourcePath)
    const relativePath = sourcePath.replace(driveLetter + '\\', '').replace(driveLetter + '/', '')
    const backupPath = path.join(jobFolder, driveLetter.replace(':', ''), relativePath)

    // Create parent directories
    await fs.mkdir(path.dirname(backupPath), { recursive: true })

    // Check if source is file or directory
    const stats = await fs.stat(sourcePath)

    if (stats.isDirectory()) {
      // Recursively copy directory
      await copyDirectory(sourcePath, backupPath)
    } else {
      // Copy single file
      await fs.copyFile(sourcePath, backupPath)
    }

    return { success: true, backupPath }
  } catch (err) {
    return {
      success: false,
      backupPath: '',
      error: err instanceof Error ? err.message : 'Unknown error'
    }
  }
}

/**
 * Recursively copy a directory
 */
async function copyDirectory(source: string, destination: string): Promise<void> {
  // Create destination directory
  await fs.mkdir(destination, { recursive: true })

  // Read source directory
  const entries = await fs.readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name)
    const destPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath)
    } else {
      await fs.copyFile(sourcePath, destPath)
    }
  }
}

/**
 * Format bytes to human readable size
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}
