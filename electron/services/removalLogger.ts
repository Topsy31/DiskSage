import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

type OperationType = 'disable' | 'restore' | 'delete'
type OperationStatus = 'success' | 'failed'

/**
 * Get the path to the log file
 */
function getLogPath(): string {
  const appDataPath = app.getPath('userData')
  const date = new Date().toISOString().split('T')[0]
  return path.join(appDataPath, 'logs', `removal-${date}.csv`)
}

/**
 * Ensure the logs directory exists
 */
async function ensureLogDir(): Promise<void> {
  const dir = path.dirname(getLogPath())
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Check if log file exists and has header
 */
async function ensureHeader(logPath: string): Promise<void> {
  try {
    await fs.access(logPath)
  } catch {
    // File doesn't exist, create with header
    const header = 'timestamp,operation,originalPath,renamedPath,status,error\n'
    await fs.writeFile(logPath, header, 'utf-8')
  }
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSV(value: string | undefined): string {
  if (!value) return ''
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Log an operation to the CSV file
 */
export async function logOperation(
  operation: OperationType,
  originalPath: string,
  renamedPath: string | undefined,
  status: OperationStatus,
  error?: string
): Promise<void> {
  try {
    await ensureLogDir()
    const logPath = getLogPath()
    await ensureHeader(logPath)

    const timestamp = new Date().toISOString()
    const line = [
      timestamp,
      operation,
      escapeCSV(originalPath),
      escapeCSV(renamedPath),
      status,
      escapeCSV(error)
    ].join(',') + '\n'

    await fs.appendFile(logPath, line, 'utf-8')
  } catch (err) {
    // Don't throw on logging errors - just log to console
    console.error('Failed to log operation:', err)
  }
}

/**
 * Get the path to today's log file (for display to user)
 */
export function getTodayLogPath(): string {
  return getLogPath()
}
