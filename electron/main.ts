import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import path from 'path'
import { parseWizTreeCSV } from './services/parser'
import { analyzeEntries } from './services/analyzer'
import { validatePath } from './services/pathValidator'
import { logAudit, logProblemReport } from './services/auditLog'
import { askClaudeAI } from './services/claude'
import { webResearch } from './services/webResearch'
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
  shell.showItemInFolder(folderPath)
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
