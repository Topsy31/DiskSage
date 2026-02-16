import { contextBridge, ipcRenderer } from 'electron'
import type { FileEntry, Classification, WebResearchResult, ProblemReport, RecommendationItem, RemovalTestJob, RemovalTestItem, AdvisorPlan, DuplicateScanConfig, DuplicateScanResult, DuplicateScanProgress } from '../src/types'

const electronAPI = {
  selectCSVFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-csv-file')
  },

  parseCSV: (filePath: string): Promise<FileEntry[]> => {
    return ipcRenderer.invoke('parse-csv', filePath)
  },

  analyzeEntries: (entries: FileEntry[]): Promise<RecommendationItem[]> => {
    return ipcRenderer.invoke('analyze-entries', entries)
  },

  validatePath: (path: string): Promise<{ isValid: boolean; warnings: string[] }> => {
    return ipcRenderer.invoke('validate-path', path)
  },

  openInExplorer: (path: string): Promise<void> => {
    return ipcRenderer.invoke('open-in-explorer', path)
  },

  askAI: (entry: FileEntry): Promise<Classification> => {
    return ipcRenderer.invoke('ask-ai', entry)
  },

  webResearch: (path: string): Promise<WebResearchResult> => {
    return ipcRenderer.invoke('web-research', path)
  },

  submitReport: (report: ProblemReport): Promise<void> => {
    return ipcRenderer.invoke('submit-report', report)
  },

  // Removal test API
  disableItems: (entries: FileEntry[], backupLocation?: string): Promise<RemovalTestJob> => {
    return ipcRenderer.invoke('disable-items', entries, backupLocation)
  },

  restoreItems: (job: RemovalTestJob): Promise<RemovalTestJob> => {
    return ipcRenderer.invoke('restore-items', job)
  },

  deleteDisabledItems: (job: RemovalTestJob): Promise<{ deleted: number; bytesFreed: number; failed: RemovalTestItem[] }> => {
    return ipcRenderer.invoke('delete-disabled-items', job)
  },

  getActiveTest: (): Promise<RemovalTestJob | null> => {
    return ipcRenderer.invoke('get-active-test')
  },

  restoreSingleItem: (job: RemovalTestJob, originalPath: string): Promise<RemovalTestJob> => {
    return ipcRenderer.invoke('restore-single-item', job, originalPath)
  },

  deleteSingleItem: (job: RemovalTestJob, originalPath: string): Promise<RemovalTestJob> => {
    return ipcRenderer.invoke('delete-single-item', job, originalPath)
  },

  // Session management API
  saveSession: (csvFilePath: string, entries: FileEntry[], recommendations: RecommendationItem[], markedPaths?: string[], advisorPlan?: AdvisorPlan | null): Promise<void> => {
    return ipcRenderer.invoke('save-session', csvFilePath, entries, recommendations, markedPaths, advisorPlan)
  },

  loadSession: (): Promise<{ csvFilePath: string; entries: FileEntry[]; recommendations: RecommendationItem[]; markedPaths?: string[]; advisorPlan?: AdvisorPlan | null; savedAt: string } | null> => {
    return ipcRenderer.invoke('load-session')
  },

  clearSession: (): Promise<void> => {
    return ipcRenderer.invoke('clear-session')
  },

  // Quick scan API
  getScanTargets: (): Promise<Array<{
    id: string
    name: string
    description: string
    category: string
    availablePaths: string[]
    exists: boolean
  }>> => {
    return ipcRenderer.invoke('get-scan-targets')
  },

  quickScan: (targetIds: string[]): Promise<FileEntry[]> => {
    return ipcRenderer.invoke('quick-scan', targetIds)
  },

  onScanProgress: (callback: (progress: { current: string; scanned: number; total: number }) => void) => {
    ipcRenderer.on('scan-progress', (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners('scan-progress')
  },

  // Backup location API
  getBackupLocation: (): Promise<string | null> => {
    return ipcRenderer.invoke('get-backup-location')
  },

  setBackupLocation: (location: string | null): Promise<void> => {
    return ipcRenderer.invoke('set-backup-location', location)
  },

  selectBackupFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-backup-folder')
  },

  getAvailableDiskSpace: (targetPath: string): Promise<number> => {
    return ipcRenderer.invoke('get-available-disk-space', targetPath)
  },

  validateBackupLocation: (backupPath: string, requiredBytes: number, sourcePaths: string[]): Promise<{
    isValid: boolean
    availableSpace: number
    requiredSpace: number
    warning?: string
    error?: string
  }> => {
    return ipcRenderer.invoke('validate-backup-location', backupPath, requiredBytes, sourcePaths)
  },

  // AI Advisor API
  getAdvisorPlan: (entries: FileEntry[], totalSize: number): Promise<AdvisorPlan> => {
    return ipcRenderer.invoke('get-advisor-plan', entries, totalSize)
  },

  getClaudeApiKey: (): Promise<string | null> => {
    return ipcRenderer.invoke('get-claude-api-key')
  },

  setClaudeApiKey: (apiKey: string | null): Promise<void> => {
    return ipcRenderer.invoke('set-claude-api-key', apiKey)
  },

  // Duplicate finder API
  selectSourceFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-source-folder')
  },

  getDefaultSkipFolders: (): Promise<string[]> => {
    return ipcRenderer.invoke('get-default-skip-folders')
  },

  startDuplicateScan: (config: DuplicateScanConfig): Promise<DuplicateScanResult> => {
    return ipcRenderer.invoke('start-duplicate-scan', config)
  },

  cancelDuplicateScan: (): Promise<void> => {
    return ipcRenderer.invoke('cancel-duplicate-scan')
  },

  onDuplicateScanProgress: (callback: (progress: DuplicateScanProgress) => void) => {
    ipcRenderer.on('duplicate-scan-progress', (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners('duplicate-scan-progress')
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Type declarations for renderer
declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}
