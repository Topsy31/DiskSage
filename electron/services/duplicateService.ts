import fs from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { BrowserWindow } from 'electron'
import type {
  DuplicateGroup, DuplicateFile, DuplicateScanConfig,
  DuplicateScanProgress, DuplicateScanResult
} from '../../src/types'

/**
 * Extension whitelist — only user content files are scanned.
 * This prevents finding "duplicates" in caches, package stores, and app data.
 */
export const SAFE_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.heic', '.raw', '.cr2', '.nef',
  // Video
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
  // Audio
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma',
  // Documents
  '.pdf', '.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt',
  // Archives
  '.zip', '.rar', '.7z', '.tar', '.gz', '.iso',
  // Installers
  '.exe', '.msi'
])

/**
 * Hard exclusions — always skipped, cannot be disabled by user.
 * These contain application data, caches, and system files that
 * appear as "duplicates" but are actively used by tools.
 */
export const HARD_SKIP_FOLDERS = [
  // System directories
  'windows', 'program files', 'program files (x86)', 'programdata',
  '$recycle.bin', 'system volume information', 'recovery',
  '$windows.~bt', '$windows.~ws',
  // Application data (caches, tool stores)
  'appdata', 'localappdata',
  // Development tool directories
  'node_modules', '.git', '__pycache__', '.venv', '.env',
  // Cache directories (any folder with these names)
  'cache', 'caches', 'cacheddata',
  // Package manager stores
  'npm-cache', '.npm', '.nuget', 'pip', '.pip',
  '.cargo', '.rustup', '.gradle', '.m2', '.ivy2',
  // Other tool stores
  'norton sandbox', '.docker', '.kube'
]

/**
 * Soft exclusions — defaults the user can add/remove.
 */
export const DEFAULT_SOFT_SKIP_FOLDERS: string[] = []

let activeController: AbortController | null = null

export function cancelDuplicateScan(): void {
  if (activeController) {
    activeController.abort()
    activeController = null
  }
}

/**
 * Check if a directory path should be skipped.
 * Matches any path segment (case-insensitive) against hard + user skip lists.
 */
function shouldSkip(dirPath: string, skipFolders: string[]): boolean {
  const segments = dirPath.split(path.sep)
  const allSkips = [...HARD_SKIP_FOLDERS, ...skipFolders]
  return segments.some(seg => allSkips.includes(seg.toLowerCase()))
}

/**
 * Check if a file extension is in the safe whitelist.
 */
function isSafeExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return SAFE_EXTENSIONS.has(ext)
}

/**
 * Compute MD5 hash of the first 8KB of a file (partial hash for pre-filtering).
 */
async function partialHash(filePath: string): Promise<string> {
  try {
    const handle = await fs.open(filePath, 'r')
    try {
      const buffer = Buffer.alloc(8192)
      const { bytesRead } = await handle.read(buffer, 0, 8192, 0)
      const hash = crypto.createHash('md5')
      hash.update(buffer.subarray(0, bytesRead))
      return hash.digest('hex')
    } finally {
      await handle.close()
    }
  } catch {
    return ''
  }
}

/**
 * Compute full SHA-256 hash of a file using streaming (64KB chunks).
 */
function fullHash(filePath: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(filePath, { highWaterMark: 65536 })

    stream.on('data', (chunk: Buffer) => {
      if (signal.aborted) {
        stream.destroy()
        resolve('')
        return
      }
      hash.update(chunk)
    })

    stream.on('end', () => {
      resolve(hash.digest('hex'))
    })

    stream.on('error', () => {
      resolve('')
    })
  })
}

/**
 * Recursive directory walker that respects skip folders and extension whitelist.
 */
async function* walkFiles(
  dir: string,
  skipFolders: string[],
  minFileSize: number,
  signal: AbortSignal
): AsyncGenerator<{ path: string; size: number; modified: Date }> {
  if (signal.aborted) return

  let entries: Awaited<ReturnType<typeof fs.readdir>>
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (signal.aborted) return

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (!shouldSkip(fullPath, skipFolders)) {
        yield* walkFiles(fullPath, skipFolders, minFileSize, signal)
      }
    } else if (entry.isFile() && isSafeExtension(entry.name)) {
      try {
        const stat = await fs.stat(fullPath)
        if (stat.size >= minFileSize) {
          yield { path: fullPath, size: stat.size, modified: stat.mtime }
        }
      } catch {
        // Skip inaccessible files
      }
    }
  }
}

/**
 * Send progress update to the renderer.
 */
function sendProgress(mainWindow: BrowserWindow | null, progress: DuplicateScanProgress): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('duplicate-scan-progress', progress)
  }
}

/**
 * Main duplicate scan — 3-pass algorithm ported from Python script.
 *
 * Pass 1: Group files by size (only whitelisted extensions, outside excluded dirs)
 * Pass 2: Partial MD5 hash (first 8KB) to narrow candidates
 * Pass 3: Full SHA-256 hash to confirm true duplicates
 */
export async function startDuplicateScan(
  config: DuplicateScanConfig,
  mainWindow: BrowserWindow | null
): Promise<DuplicateScanResult> {
  activeController = new AbortController()
  const { signal } = activeController
  const startTime = Date.now()

  // ── Pass 1: Size grouping ──────────────────────────────────────────────
  const sizeMap = new Map<number, Array<{ path: string; modified: Date }>>()
  let filesScanned = 0

  sendProgress(mainWindow, {
    phase: 'sizing',
    filesScanned: 0,
    totalFiles: 0,
    candidatesFound: 0,
    duplicateGroupsFound: 0
  })

  for await (const file of walkFiles(config.sourceFolder, config.skipFolders, config.minFileSize, signal)) {
    if (signal.aborted) throw new Error('Scan cancelled')

    const group = sizeMap.get(file.size)
    if (group) {
      group.push({ path: file.path, modified: file.modified })
    } else {
      sizeMap.set(file.size, [{ path: file.path, modified: file.modified }])
    }

    filesScanned++
    if (filesScanned % 500 === 0) {
      sendProgress(mainWindow, {
        phase: 'sizing',
        filesScanned,
        totalFiles: 0,
        candidatesFound: 0,
        duplicateGroupsFound: 0,
        currentFile: file.path
      })
    }
  }

  // Filter to only groups with 2+ files of the same size
  const candidates: Array<[number, Array<{ path: string; modified: Date }>]> = []
  let candidateCount = 0
  for (const [size, files] of sizeMap) {
    if (files.length >= 2) {
      candidates.push([size, files])
      candidateCount += files.length
    }
  }

  sendProgress(mainWindow, {
    phase: 'sizing',
    filesScanned,
    totalFiles: filesScanned,
    candidatesFound: candidateCount,
    duplicateGroupsFound: 0
  })

  // ── Pass 2: Partial hash ───────────────────────────────────────────────
  // Group by (size, partialHash) composite key
  const partialGroups = new Map<string, Array<{ path: string; modified: Date }>>()
  let partialScanned = 0

  sendProgress(mainWindow, {
    phase: 'partial-hash',
    filesScanned: 0,
    totalFiles: candidateCount,
    candidatesFound: candidateCount,
    duplicateGroupsFound: 0
  })

  for (const [size, files] of candidates) {
    if (signal.aborted) throw new Error('Scan cancelled')

    for (const file of files) {
      if (signal.aborted) throw new Error('Scan cancelled')

      const ph = await partialHash(file.path)
      if (!ph) continue

      const key = `${size}:${ph}`
      const group = partialGroups.get(key)
      if (group) {
        group.push(file)
      } else {
        partialGroups.set(key, [file])
      }

      partialScanned++
      if (partialScanned % 100 === 0) {
        sendProgress(mainWindow, {
          phase: 'partial-hash',
          filesScanned: partialScanned,
          totalFiles: candidateCount,
          candidatesFound: candidateCount,
          duplicateGroupsFound: 0,
          currentFile: file.path
        })
      }
    }
  }

  // Filter to groups with 2+ matching partial hashes
  const partialCandidates: Array<[string, Array<{ path: string; modified: Date }>]> = []
  let fullHashCandidateCount = 0
  for (const [key, files] of partialGroups) {
    if (files.length >= 2) {
      partialCandidates.push([key, files])
      fullHashCandidateCount += files.length
    }
  }

  // ── Pass 3: Full SHA-256 hash ──────────────────────────────────────────
  const fullGroups = new Map<string, Array<{ path: string; modified: Date }>>()
  let fullScanned = 0

  sendProgress(mainWindow, {
    phase: 'full-hash',
    filesScanned: 0,
    totalFiles: fullHashCandidateCount,
    candidatesFound: fullHashCandidateCount,
    duplicateGroupsFound: 0
  })

  for (const [, files] of partialCandidates) {
    if (signal.aborted) throw new Error('Scan cancelled')

    for (const file of files) {
      if (signal.aborted) throw new Error('Scan cancelled')

      const fh = await fullHash(file.path, signal)
      if (!fh) continue

      const group = fullGroups.get(fh)
      if (group) {
        group.push(file)
      } else {
        fullGroups.set(fh, [file])
      }

      fullScanned++
      if (fullScanned % 50 === 0) {
        const groupCount = [...fullGroups.values()].filter(g => g.length >= 2).length
        sendProgress(mainWindow, {
          phase: 'full-hash',
          filesScanned: fullScanned,
          totalFiles: fullHashCandidateCount,
          candidatesFound: fullHashCandidateCount,
          duplicateGroupsFound: groupCount,
          currentFile: file.path
        })
      }
    }
  }

  // ── Build results ──────────────────────────────────────────────────────
  const groups: DuplicateGroup[] = []
  let totalDuplicateSize = 0
  let groupIndex = 0

  for (const [hash, files] of fullGroups) {
    if (files.length < 2) continue

    // Keeper heuristic: shortest path (most canonical location)
    const sorted = [...files].sort((a, b) => {
      if (a.path.length !== b.path.length) return a.path.length - b.path.length
      return a.path.localeCompare(b.path)
    })

    // Get file size from the first candidate's partial group key
    let fileSize = 0
    try {
      const stat = await fs.stat(sorted[0].path)
      fileSize = stat.size
    } catch {
      continue
    }

    const duplicateFiles: DuplicateFile[] = sorted.map((f, i) => ({
      path: f.path,
      modified: f.modified,
      isKeeper: i === 0
    }))

    groups.push({
      id: `dup-${groupIndex++}`,
      hash,
      fileSize,
      files: duplicateFiles,
      keeperIndex: 0
    })

    // Total duplicate size = sum of all non-keeper files
    totalDuplicateSize += fileSize * (files.length - 1)
  }

  // Sort groups by total wasted space (largest first)
  groups.sort((a, b) => {
    const wasteA = a.fileSize * (a.files.length - 1)
    const wasteB = b.fileSize * (b.files.length - 1)
    return wasteB - wasteA
  })

  const duration = Date.now() - startTime

  sendProgress(mainWindow, {
    phase: 'complete',
    filesScanned,
    totalFiles: filesScanned,
    candidatesFound: candidateCount,
    duplicateGroupsFound: groups.length
  })

  activeController = null

  return {
    groups,
    totalDuplicateSize,
    scanDuration: duration,
    filesScanned
  }
}
