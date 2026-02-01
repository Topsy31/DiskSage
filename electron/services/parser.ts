import fs from 'fs'
import readline from 'readline'
import type { FileEntry } from '../../src/types'

/**
 * Parse a WizTree CSV export file using streaming to handle large files.
 * WizTree CSV format: "File Name","Size","Allocated","Modified","Attributes","Files","Folders"
 */
export async function parseWizTreeCSV(filePath: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = []
  let isFirstLine = true
  let lineCount = 0
  const maxEntries = 5000 // Limit to top entries to avoid memory issues

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    rl.on('line', (line) => {
      // Skip header
      if (isFirstLine) {
        isFirstLine = false
        return
      }

      // Limit entries to prevent memory issues
      if (entries.length >= maxEntries) {
        return
      }

      lineCount++

      try {
        const entry = parseLine(line)
        if (entry && entry.size > 0) {
          entries.push(entry)
        }
      } catch (err) {
        // Skip malformed lines silently
      }
    })

    rl.on('close', () => {
      // Sort by size descending and take top entries
      entries.sort((a, b) => b.size - a.size)
      console.log(`Parsed ${lineCount} lines, returning ${entries.length} entries`)
      resolve(entries)
    })

    rl.on('error', (err) => {
      reject(err)
    })

    fileStream.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Parse a single CSV line.
 * Handles quoted fields and commas within paths.
 */
function parseLine(line: string): FileEntry | null {
  const fields = parseCSVLine(line)

  if (fields.length < 5) {
    return null
  }

  const [path, sizeStr, allocatedStr, modifiedStr, attributes, filesStr, foldersStr] = fields

  // Skip header or invalid rows
  if (path === 'File Name' || !path) {
    return null
  }

  // Clean up the path - remove surrounding quotes
  const cleanPath = path.replace(/^"|"$/g, '')

  // Skip individual files, only process folders (folders have Files/Folders counts)
  // WizTree exports folders with file/folder counts
  const files = filesStr ? parseInt(filesStr, 10) : undefined
  const folders = foldersStr ? parseInt(foldersStr, 10) : undefined

  // If no files or folders count, this might be a file not a folder - skip small items
  const size = parseSize(sizeStr)
  if (size < 1024 * 1024) { // Skip items smaller than 1MB
    return null
  }

  return {
    path: cleanPath,
    size,
    allocated: parseSize(allocatedStr),
    modified: parseDate(modifiedStr),
    attributes: attributes || '',
    files,
    folders
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
        // Escaped quote
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
 * Parse size value (WizTree uses plain numbers in bytes).
 */
function parseSize(sizeStr: string): number {
  const cleaned = sizeStr.replace(/[",]/g, '')
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? 0 : num
}

/**
 * Parse date from WizTree format (DD/MM/YYYY HH:mm:ss or similar).
 */
function parseDate(dateStr: string): Date {
  const cleaned = dateStr.replace(/"/g, '').trim()

  // Try common formats
  // WizTree typically uses: DD/MM/YYYY HH:mm:ss
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

  // Fallback: try native parsing
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
