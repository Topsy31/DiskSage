import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import path from 'path'
import { parseWizTreeCSV } from './services/parser'
import { analyzeEntries } from './services/analyzer'
import { validatePath } from './services/pathValidator'
import { logAudit, logProblemReport } from './services/auditLog'
import { askClaudeAI, getAdvisorPlan } from './services/claude'
import { webResearch } from './services/webResearch'
import { disableItems, restoreItems, deleteDisabledItems, getActiveTest, restoreSingleItem, deleteSingleItem } from './services/removalService'
import { saveSession, loadSession, clearSession } from './services/sessionService'
import { quickScan, getAvailableTargets, SCAN_TARGETS } from './services/scanner'
import { getBackupLocation, setBackupLocation, getClaudeApiKey, setClaudeApiKey } from './services/settingsService'
import { getAvailableDiskSpace, validateBackupLocation } from './services/backupService'
import { v4 as uuidv4 } from 'uuid'

// Session ID for audit logging
const sessionId = uuidv4()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'DiskSage'
  })

  // In development, load from Vite dev server
  // vite-plugin-electron sets this automatically
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // Production build
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Open DevTools in development
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC Handlers

ipcMain.handle('select-csv-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select WizTree CSV Export',
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('parse-csv', async (_event, filePath: string) => {
  return parseWizTreeCSV(filePath)
})

ipcMain.handle('analyze-entries', async (_event, entries) => {
  const recommendations = await analyzeEntries(entries, sessionId)

  // Log each recommendation
  for (const rec of recommendations) {
    await logAudit({
      timestamp: new Date().toISOString(),
      sessionId,
      path: rec.entry.path,
      size: rec.entry.size,
      riskScore: rec.classification.riskScore,
      confidence: rec.classification.confidence,
      recommendation: rec.classification.recommendation,
      source: rec.classification.source,
      ruleId: rec.classification.ruleId
    })
  }

  return recommendations
})

ipcMain.handle('validate-path', async (_event, pathToValidate: string) => {
  return validatePath(pathToValidate)
})

ipcMain.handle('open-in-explorer', async (_event, folderPath: string) => {
  try {
    const stats = await import('fs/promises').then(fs => fs.stat(folderPath))
    if (stats.isDirectory()) {
      shell.openPath(folderPath)
    } else {
      shell.showItemInFolder(folderPath)
    }
  } catch {
    // Path doesn't exist or is inaccessible — open the nearest parent that exists
    const path = await import('path')
    let dir = folderPath
    const fs = await import('fs/promises')
    while (dir) {
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
      try {
        await fs.access(dir)
        shell.openPath(dir)
        return
      } catch {
        continue
      }
    }
    shell.showItemInFolder(folderPath)
  }
})

ipcMain.handle('ask-ai', async (_event, entry) => {
  const result = await askClaudeAI(entry)

  await logAudit({
    timestamp: new Date().toISOString(),
    sessionId,
    path: entry.path,
    size: entry.size,
    riskScore: result.riskScore,
    confidence: result.confidence,
    recommendation: result.recommendation,
    source: 'ai',
    aiResponse: result.explanation
  })

  return result
})

ipcMain.handle('web-research', async (_event, pathToResearch: string) => {
  return webResearch(pathToResearch)
})

ipcMain.handle('submit-report', async (_event, report) => {
  await logProblemReport(report)
})

// Removal test handlers

ipcMain.handle('disable-items', async (_event, entries, backupLocation?: string) => {
  return disableItems(entries, backupLocation)
})

ipcMain.handle('restore-items', async (_event, job) => {
  return restoreItems(job)
})

ipcMain.handle('delete-disabled-items', async (_event, job) => {
  return deleteDisabledItems(job)
})

ipcMain.handle('get-active-test', async () => {
  return getActiveTest()
})

ipcMain.handle('restore-single-item', async (_event, job, originalPath: string) => {
  return restoreSingleItem(job, originalPath)
})

ipcMain.handle('delete-single-item', async (_event, job, originalPath: string) => {
  return deleteSingleItem(job, originalPath)
})

// Session management handlers

ipcMain.handle('save-session', async (_event, csvFilePath: string, entries, recommendations, markedPaths?: string[], advisorPlan?: any) => {
  return saveSession(csvFilePath, entries, recommendations, markedPaths, advisorPlan)
})

ipcMain.handle('load-session', async () => {
  return loadSession()
})

ipcMain.handle('clear-session', async () => {
  return clearSession()
})

// Quick scan handlers

ipcMain.handle('get-scan-targets', async () => {
  return getAvailableTargets()
})

ipcMain.handle('quick-scan', async (_event, targetIds: string[]) => {
  return quickScan(targetIds, mainWindow)
})

// Backup location handlers

ipcMain.handle('get-backup-location', async () => {
  return getBackupLocation()
})

ipcMain.handle('set-backup-location', async (_event, location: string | null) => {
  return setBackupLocation(location)
})

ipcMain.handle('select-backup-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Backup Location',
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('get-available-disk-space', async (_event, targetPath: string) => {
  return getAvailableDiskSpace(targetPath)
})

ipcMain.handle('validate-backup-location', async (_event, backupPath: string, requiredBytes: number, sourcePaths: string[]) => {
  return validateBackupLocation(backupPath, requiredBytes, sourcePaths)
})

// AI Advisor handlers

ipcMain.handle('get-advisor-plan', async (_event, entries, totalSize: number) => {
  return getAdvisorPlan(entries, totalSize)
})

ipcMain.handle('get-claude-api-key', async () => {
  return getClaudeApiKey()
})

ipcMain.handle('set-claude-api-key', async (_event, apiKey: string | null) => {
  return setClaudeApiKey(apiKey)
})

// Duplicate finder handlers

ipcMain.handle('select-source-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Folder to Scan for Duplicates',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('get-default-skip-folders', async () => {
  const { DEFAULT_SOFT_SKIP_FOLDERS } = await import('./services/duplicateService')
  return DEFAULT_SOFT_SKIP_FOLDERS
})

ipcMain.handle('start-duplicate-scan', async (_event, config) => {
  const { startDuplicateScan } = await import('./services/duplicateService')
  return startDuplicateScan(config, mainWindow)
})

ipcMain.handle('cancel-duplicate-scan', async () => {
  const { cancelDuplicateScan } = await import('./services/duplicateService')
  cancelDuplicateScan()
})
