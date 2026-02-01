import type { FileEntry, Classification, WebResearchResult, ProblemReport, RecommendationItem, RemovalTestJob, RemovalTestItem } from './types'

export interface ElectronAPI {
  selectCSVFile: () => Promise<string | null>
  parseCSV: (filePath: string) => Promise<FileEntry[]>
  analyzeEntries: (entries: FileEntry[]) => Promise<RecommendationItem[]>
  validatePath: (path: string) => Promise<{ isValid: boolean; warnings: string[] }>
  openInExplorer: (path: string) => Promise<void>
  askAI: (entry: FileEntry) => Promise<Classification>
  webResearch: (path: string) => Promise<WebResearchResult>
  submitReport: (report: ProblemReport) => Promise<void>

  // Removal test API
  disableItems: (entries: FileEntry[]) => Promise<RemovalTestJob>
  restoreItems: (job: RemovalTestJob) => Promise<RemovalTestJob>
  deleteDisabledItems: (job: RemovalTestJob) => Promise<{ deleted: number; bytesFreed: number; failed: RemovalTestItem[] }>
  getActiveTest: () => Promise<RemovalTestJob | null>

  // Session management API
  saveSession: (csvFilePath: string, entries: FileEntry[], recommendations: RecommendationItem[]) => Promise<void>
  loadSession: () => Promise<{ csvFilePath: string; entries: FileEntry[]; recommendations: RecommendationItem[]; savedAt: string } | null>
  clearSession: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
