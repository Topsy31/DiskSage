import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import type { AuditEntry, ProblemReport } from '../../src/types'

// Get app data directory
function getAppDataPath(): string {
  return path.join(app.getPath('userData'), 'DiskSage')
}

function getAuditLogPath(): string {
  return path.join(getAppDataPath(), 'audit.log')
}

function getReportLogPath(): string {
  return path.join(getAppDataPath(), 'problem-reports.log')
}

// Ensure directory exists
async function ensureDir(): Promise<void> {
  const dir = getAppDataPath()
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
}

/**
 * Log an audit entry for every recommendation made.
 * This creates a complete record for debugging and improvement.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  await ensureDir()

  const logPath = getAuditLogPath()
  const logLine = JSON.stringify(entry) + '\n'

  await fs.appendFile(logPath, logLine, 'utf-8')
}

/**
 * Log a problem report from the user.
 * These are critical for identifying incorrect recommendations.
 */
export async function logProblemReport(report: ProblemReport): Promise<void> {
  await ensureDir()

  const logPath = getReportLogPath()
  const logLine = JSON.stringify({
    ...report,
    reportedAt: new Date().toISOString()
  }) + '\n'

  await fs.appendFile(logPath, logLine, 'utf-8')
}

/**
 * Read all audit entries for debugging.
 */
export async function readAuditLog(): Promise<AuditEntry[]> {
  await ensureDir()

  try {
    const content = await fs.readFile(getAuditLogPath(), 'utf-8')
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
  } catch {
    return []
  }
}

/**
 * Read all problem reports.
 */
export async function readProblemReports(): Promise<ProblemReport[]> {
  await ensureDir()

  try {
    const content = await fs.readFile(getReportLogPath(), 'utf-8')
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
  } catch {
    return []
  }
}

/**
 * Clear audit log (for testing or privacy).
 */
export async function clearAuditLog(): Promise<void> {
  await ensureDir()
  await fs.writeFile(getAuditLogPath(), '', 'utf-8')
}
