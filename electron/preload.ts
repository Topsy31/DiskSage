import { contextBridge, ipcRenderer } from 'electron'
import type { FileEntry, Classification, WebResearchResult, ProblemReport, RecommendationItem } from '../src/types'

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
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Type declarations for renderer
declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}
