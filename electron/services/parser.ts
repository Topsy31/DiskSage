import fs from 'fs'
import readline from 'readline'
import type { FileEntry } from '../../src/types'

interface FolderNode {
  path: string
  size: number
  files: number
  folders: number
  modified: Date
  children: Map<string, FolderNode>
}

/**
 * Parse a WizTree CSV export file using streaming.
 * Aggregates to folder level during parse - handles millions of rows efficiently.
 */
export async function parseWizTreeCSV(filePath: string): Promise<FileEntry[]> {
  const MIN_SIZE_BYTES = 10 * 1024 * 1024 // 10MB minimum to include in results

  // Root node for the tree
  const root: FolderNode = {
    path: '',
    size: 0,
    files: 0,
    folders: 0,
    modified: new Date(0),
    children: new Map()
  }

  let lineCount = 0
  let skippedCount = 0

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    let isFirstLine = true

    rl.on('line', (line) => {
      // Skip header
      if (isFirstLine) {
        isFirstLine = false
        return
      }

      lineCount++

      // Log progress every 100k lines
      if (lineCount % 100000 === 0) {
        console.log(`Parsed ${lineCount} lines...`)
      }

      try {
        const parsed = parseLine(line)
        if (parsed) {
          // Add this entry to the tree (sizes accumulated per-node)
          addToTree(root, parsed.path, parsed.size, parsed.modified)
        }
      } catch (err) {
        skippedCount++
      }
    })

    rl.on('close', () => {
      console.log(`Finished parsing ${lineCount} lines (${skippedCount} skipped)`)

      // Now propagate sizes up from leaves to parents (single pass)
      propagateSizes(root)

      // Convert tree to flat list of significant folders
      const entries = flattenTree(root, MIN_SIZE_BYTES)

      console.log(`Returning ${entries.length} folder entries >= ${formatSize(MIN_SIZE_BYTES)}`)
      resolve(entries)
    })

    rl.on('error', reject)
    fileStream.on('error', reject)
  })
}

/**
 * Add a file/folder to the tree. Does NOT propagate sizes yet.
 */
function addToTree(root: FolderNode, path: string, size: number, modified: Date): void {
  // Normalise path
  const normPath = path.replace(/\\$/, '')
  const parts = normPath.split('\\').filter(p => p)

  if (parts.length === 0) return

  let current = root
  let currentPath = ''

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    // Build path
    if (i === 0 && part.match(/^[A-Z]:$/i)) {
      currentPath = part
    } else {
      currentPath = currentPath ? currentPath + '\\' + part : part
    }

    // Get or create child node
    let child = current.children.get(part.toLowerCase())
    if (!child) {
      child = {
        path: currentPath,
        size: 0,
        files: 0,
        folders: 0,
        modified: new Date(0),
        children: new Map()
      }
      current.children.set(part.toLowerCase(), child)
    }

    // If this is the final segment (the actual entry), record its size
    if (i === parts.length - 1) {
      // Use max in case we see the same path multiple times
      child.size = Math.max(child.size, size)
      child.files++
      if (modified > child.modified) {
        child.modified = modified
      }
    }

    current = child
  }
}

/**
 * Recalculate sizes from children (post-order traversal).
 * Called ONCE after all entries are added.
 */
function propagateSizes(node: FolderNode): number {
  if (node.children.size === 0) {
    // Leaf node - return its own size
    return node.size
  }

  // Sum children's sizes
  let childSum = 0
  for (const child of node.children.values()) {
    childSum += propagateSizes(child)
  }

  // Use the larger of: direct size (from CSV) or sum of children
  // WizTree sometimes reports folder totals directly
  node.size = Math.max(node.size, childSum)
  node.folders = node.children.size

  return node.size
}

/**
 * Flatten tree to array, only including folders above size threshold.
 */
function flattenTree(root: FolderNode, minSize: number): FileEntry[] {
  const results: FileEntry[] = []

  function traverse(node: FolderNode) {
    // Only include if above threshold and has a path
    if (node.size >= minSize && node.path) {
      results.push({
        path: node.path,
        size: node.size,
        allocated: node.size,
        modified: node.modified,
        attributes: '',
        files: node.files,
        folders: node.folders
      })
    }

    // Always traverse children (they might be large even if parent isn't filtered)
    for (const child of node.children.values()) {
      traverse(child)
    }
  }

  traverse(root)

  // Sort by size descending
  results.sort((a, b) => b.size - a.size)

  return results
}

/**
 * Parse a single CSV line.
 */
function parseLine(line: string): { path: string; size: number; modified: Date } | null {
  const fields = parseCSVLine(line)

  if (fields.length < 4) {
    return null
  }

  const [path, sizeStr, , modifiedStr] = fields

  if (!path || path === 'File Name') {
    return null
  }

  const cleanPath = path.replace(/^"|"$/g, '')
  const size = parseSize(sizeStr)

  if (size <= 0) {
    return null
  }

  return {
    path: cleanPath,
    size,
    modified: parseDate(modifiedStr)
  }
}

/**
 * Parse a CSV line handling quoted fields correctly.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current.trim())
  return fields
}

/**
 * Parse size value.
 */
function parseSize(sizeStr: string): number {
  const cleaned = sizeStr.replace(/[",]/g, '')
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? 0 : num
}

/**
 * Parse date from WizTree format.
 */
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date()

  const cleaned = dateStr.replace(/"/g, '').trim()
  const match = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/)

  if (match) {
    const [, day, month, year, hour, minute, second] = match
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    )
  }

  const date = new Date(cleaned)
  return isNaN(date.getTime()) ? new Date() : date
}

/**
 * Format bytes to human-readable size.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}
