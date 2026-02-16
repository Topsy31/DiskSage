import type { FileEntry, Classification, WebResearchResult, ProblemReport, RecommendationItem, RemovalTestJob, RemovalTestItem, BackupValidation, AdvisorPlan, DuplicateScanConfig, DuplicateScanResult, DuplicateScanProgress } from './types'

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
  disableItems: (entries: FileEntry[], backupLocation?: string) => Promise<RemovalTestJob>
  restoreItems: (job: RemovalTestJob) => Promise<RemovalTestJob>
  deleteDisabledItems: (job: RemovalTestJob) => Promise<{ deleted: number; bytesFreed: number; failed: RemovalTestItem[] }>
  getActiveTest: () => Promise<RemovalTestJob | null>

  // Session management API
  saveSession: (csvFilePath: string, entries: FileEntry[], recommendations: RecommendationItem[], markedPaths?: string[], advisorPlan?: AdvisorPlan | null) => Promise<void>
  loadSession: () => Promise<{ csvFilePath: string; entries: FileEntry[]; recommendations: RecommendationItem[]; markedPaths?: string[]; advisorPlan?: AdvisorPlan | null; savedAt: string } | null>
  clearSession: () => Promise<void>

  // Quick scan API
  getScanTargets: () => Promise<Array<{
    id: string
    name: string
    description: string
    category: string
    availablePaths: string[]
    exists: boolean
  }>>
  quickScan: (targetIds: string[]) => Promise<FileEntry[]>
  onScanProgress: (callback: (progress: { current: string; scanned: number; total: number }) => void) => () => void

  // Backup location API
  getBackupLocation: () => Promise<string | null>
  setBackupLocation: (location: string | null) => Promise<void>
  selectBackupFolder: () => Promise<string | null>
  getAvailableDiskSpace: (targetPath: string) => Promise<number>
  validateBackupLocation: (backupPath: string, requiredBytes: number, sourcePaths: string[]) => Promise<BackupValidation>

  // AI Advisor API
  getAdvisorPlan: (entries: FileEntry[], totalSize: number) => Promise<AdvisorPlan>
  getClaudeApiKey: () => Promise<string | null>
  setClaudeApiKey: (apiKey: string | null) => Promise<void>

  // Duplicate finder API
  selectSourceFolder: () => Promise<string | null>
  getDefaultSkipFolders: () => Promise<string[]>
  startDuplicateScan: (config: DuplicateScanConfig) => Promise<DuplicateScanResult>
  cancelDuplicateScan: () => Promise<void>
  onDuplicateScanProgress: (callback: (progress: DuplicateScanProgress) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
