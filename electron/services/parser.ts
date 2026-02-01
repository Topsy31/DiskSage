import fs from 'fs/promises'
import type { FileEntry } from '../../src/types'

/**
 * Parse a WizTree CSV export file.
 * WizTree CSV format: "File Name","Size","Allocated","Modified","Attributes","Files","Folders"
 */
export async function parseWizTreeCSV(filePath: string): Promise<FileEntry[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n')

  // Skip header row
  const entries: FileEntry[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    try {
      const entry = parseLine(line)
      if (entry) {
        entries.push(entry)
      }
    } catch (err) {
      // Skip malformed lines
      console.warn(`Skipping malformed line ${i + 1}:`, err)
    }
  }

  return entries
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

  return {
    path: path.replace(/^"|"$/g, ''),
    size: parseSize(sizeStr),
    allocated: parseSize(allocatedStr),
    modified: parseDate(modifiedStr),
    attributes: attributes || '',
    files: filesStr ? parseInt(filesStr, 10) : undefined,
    folders: foldersStr ? parseInt(foldersStr, 10) : undefined
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
