import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'
import type { FileEntry } from '../../src/types'

export interface ScanTarget {
  id: string
  name: string
  description: string
  paths: string[]  // Environment variable paths to resolve
  category: 'temp' | 'cache' | 'dev' | 'downloads' | 'other'
}

// Predefined scan targets for common low-risk locations
export const SCAN_TARGETS: ScanTarget[] = [
  {
    id: 'windows-temp',
    name: 'Windows Temp',
    description: 'System temporary files',
    paths: ['C:\\Windows\\Temp'],
    category: 'temp'
  },
  {
    id: 'user-temp',
    name: 'User Temp',
    description: 'User temporary files',
    paths: ['%TEMP%', '%TMP%'],
    category: 'temp'
  },
  {
    id: 'browser-cache',
    name: 'Browser Caches',
    description: 'Chrome, Edge, Firefox caches',
    paths: [
      '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cache',
      '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Code Cache',
      '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Cache',
      '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Code Cache',
      '%LOCALAPPDATA%\\Mozilla\\Firefox\\Profiles'
    ],
    category: 'cache'
  },
  {
    id: 'windows-cache',
    name: 'Windows Caches',
    description: 'Windows update and thumbnail caches',
    paths: [
      '%LOCALAPPDATA%\\Microsoft\\Windows\\INetCache',
      '%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer'  // Thumbnail cache
    ],
    category: 'cache'
  },
  {
    id: 'npm-cache',
    name: 'npm Cache',
    description: 'Node.js package manager cache',
    paths: ['%LOCALAPPDATA%\\npm-cache', '%APPDATA%\\npm-cache'],
    category: 'dev'
  },
  {
    id: 'nuget-cache',
    name: 'NuGet Cache',
    description: '.NET package manager cache',
    paths: ['%LOCALAPPDATA%\\NuGet\\Cache', '%USERPROFILE%\\.nuget\\packages'],
    category: 'dev'
  },
  {
    id: 'pip-cache',
    name: 'pip Cache',
    description: 'Python package manager cache',
    paths: ['%LOCALAPPDATA%\\pip\\Cache'],
    category: 'dev'
  },
  {
    id: 'gradle-cache',
    name: 'Gradle Cache',
    description: 'Java/Android build cache',
    paths: ['%USERPROFILE%\\.gradle\\caches'],
    category: 'dev'
  },
  {
    id: 'maven-cache',
    name: 'Maven Cache',
    description: 'Java build dependency cache',
    paths: ['%USERPROFILE%\\.m2\\repository'],
    category: 'dev'
  },
  {
    id: 'vscode-cache',
    name: 'VS Code Cache',
    description: 'Visual Studio Code caches',
    paths: [
      '%APPDATA%\\Code\\Cache',
      '%APPDATA%\\Code\\CachedData',
      '%APPDATA%\\Code\\CachedExtensions',
      '%APPDATA%\\Code\\CachedExtensionVSIXs'
    ],
    category: 'cache'
  },
  {
    id: 'downloads',
    name: 'Downloads',
    description: 'User downloads folder (review carefully)',
    paths: ['%USERPROFILE%\\Downloads'],
    category: 'downloads'
  }
]

/**
 * Resolve environment variables in a path
 */
function resolvePath(pathWithEnvVars: string): string {
  return pathWithEnvVars.replace(/%([^%]+)%/g, (_, envVar) => {
    return process.env[envVar] || ''
  })
}

/**
 * Check if a path exists
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Get folder size and stats recursively
 */
async function getFolderStats(folderPath: string): Promise<{ size: number; files: number; folders: number; modified: Date }> {
  let size = 0
  let files = 0
  let folders = 0
  let latestModified = new Date(0)

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        try {
          if (entry.isDirectory()) {
            folders++
            await walk(fullPath)
          } else if (entry.isFile()) {
            files++
            const stat = await fs.stat(fullPath)
            size += stat.size
            if (stat.mtime > latestModified) {
              latestModified = stat.mtime
            }
          }
        } catch {
          // Skip files/folders we can't access
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await walk(folderPath)

  return { size, files, folders, modified: latestModified }
}

export interface ScanProgress {
  current: string
  scanned: number
  total: number
}

/**
 * Scan selected targets and return FileEntry array
 */
export async function quickScan(
  targetIds: string[],
  mainWindow: BrowserWindow | null,
  onProgress?: (progress: ScanProgress) => void
): Promise<FileEntry[]> {
  const entries: FileEntry[] = []
  const pathsToScan: { path: string; targetId: string }[] = []

  // Resolve all paths from selected targets
  for (const targetId of targetIds) {
    const target = SCAN_TARGETS.find(t => t.id === targetId)
    if (!target) continue

    for (const p of target.paths) {
      const resolved = resolvePath(p)
      if (resolved && await pathExists(resolved)) {
        pathsToScan.push({ path: resolved, targetId })
      }
    }
  }

  // Remove duplicates
  const uniquePaths = [...new Map(pathsToScan.map(p => [p.path.toLowerCase(), p])).values()]

  let scanned = 0
  const total = uniquePaths.length

  for (const { path: folderPath } of uniquePaths) {
    // Report progress
    if (onProgress) {
      onProgress({
        current: folderPath,
        scanned,
        total
      })
    }

    // Send progress to renderer
    if (mainWindow) {
      mainWindow.webContents.send('scan-progress', {
        current: folderPath,
        scanned,
        total
      })
    }

    try {
      const stats = await getFolderStats(folderPath)

      // Only include if folder has content
      if (stats.size > 0) {
        entries.push({
          path: folderPath,
          size: stats.size,
          allocated: stats.size,
          modified: stats.modified,
          attributes: '',
          files: stats.files,
          folders: stats.folders
        })
      }

      // Also scan immediate subfolders for better granularity
      try {
        const subfolders = await fs.readdir(folderPath, { withFileTypes: true })
        for (const sub of subfolders) {
          if (sub.isDirectory()) {
            const subPath = path.join(folderPath, sub.name)
            try {
              const subStats = await getFolderStats(subPath)
              if (subStats.size > 0) {
                entries.push({
                  path: subPath,
                  size: subStats.size,
                  allocated: subStats.size,
                  modified: subStats.modified,
                  attributes: '',
                  files: subStats.files,
                  folders: subStats.folders
                })
              }
            } catch {
              // Skip inaccessible subfolders
            }
          }
        }
      } catch {
        // Skip if can't read subfolders
      }
    } catch {
      // Skip inaccessible folders
    }

    scanned++
  }

  // Sort by size descending
  entries.sort((a, b) => b.size - a.size)

  return entries
}

/**
 * Get available scan targets with resolved paths and existence check
 */
export async function getAvailableTargets(): Promise<Array<ScanTarget & { availablePaths: string[]; exists: boolean }>> {
  const results = []

  for (const target of SCAN_TARGETS) {
    const availablePaths: string[] = []

    for (const p of target.paths) {
      const resolved = resolvePath(p)
      if (resolved && await pathExists(resolved)) {
        availablePaths.push(resolved)
      }
    }

    results.push({
      ...target,
      availablePaths,
      exists: availablePaths.length > 0
    })
  }

  return results
}
