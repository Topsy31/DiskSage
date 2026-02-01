import type { FileEntry, Classification, WebResearchResult, ProblemReport, RecommendationItem } from './types'

export interface ElectronAPI {
  parseCSV: (filePath: string) => Promise<FileEntry[]>
  analyzeEntries: (entries: FileEntry[]) => Promise<RecommendationItem[]>
  validatePath: (path: string) => Promise<{ isValid: boolean; warnings: string[] }>
  openInExplorer: (path: string) => Promise<void>
  askAI: (entry: FileEntry) => Promise<Classification>
  webResearch: (path: string) => Promise<WebResearchResult>
  submitReport: (report: ProblemReport) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
