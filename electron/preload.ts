import { contextBridge, ipcRenderer } from 'electron'
import type { FileEntry, Classification, WebResearchResult, ProblemReport, RecommendationItem, RemovalTestJob, RemovalTestItem } from '../src/types'

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
  disableItems: (entries: FileEntry[]): Promise<RemovalTestJob> => {
    return ipcRenderer.invoke('disable-items', entries)
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

  // Session management API
  saveSession: (csvFilePath: string, entries: FileEntry[], recommendations: RecommendationItem[]): Promise<void> => {
    return ipcRenderer.invoke('save-session', csvFilePath, entries, recommendations)
  },

  loadSession: (): Promise<{ csvFilePath: string; entries: FileEntry[]; recommendations: RecommendationItem[]; savedAt: string } | null> => {
    return ipcRenderer.invoke('load-session')
  },

  clearSession: (): Promise<void> => {
    return ipcRenderer.invoke('clear-session')
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Type declarations for renderer
declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}
