import { useState, useEffect, useMemo, useCallback } from 'react'
import type { DuplicateScanConfig, DuplicateScanProgress, DuplicateScanResult, DuplicateGroup, FileEntry, RemovalTestJob, BackupValidation } from '../types'
import BackupLocationPanel from './BackupLocationPanel'

interface DuplicatesTabProps {
  backupLocation: string | null
  onBackupLocationChange: (location: string | null) => void
  activeTest: RemovalTestJob | null
  onTestRemoval: (entries: FileEntry[], backupLocation: string) => void
  onUndoTest: () => void
  onConfirmDelete: () => void
  onUndoSingleItem: (originalPath: string) => void
  onDeleteSingleItem: (originalPath: string) => void
  isTestLoading: boolean
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m ${remaining}s`
}

const PHASE_LABELS: Record<string, string> = {
  'sizing': 'Phase 1: Scanning files...',
  'partial-hash': 'Phase 2: Comparing partial hashes...',
  'full-hash': 'Phase 3: Verifying full hashes...',
  'complete': 'Scan complete'
}

export default function DuplicatesTab({
  backupLocation,
  onBackupLocationChange,
  activeTest,
  onTestRemoval,
  onUndoTest,
  onConfirmDelete,
  onUndoSingleItem,
  onDeleteSingleItem,
  isTestLoading
}: DuplicatesTabProps) {
  // Internal state
  const [phase, setPhase] = useState<'config' | 'scanning' | 'results'>('config')
  const [sourceFolder, setSourceFolder] = useState<string | null>(null)
  const [skipFolders, setSkipFolders] = useState<string[]>([])
  const [newSkipFolder, setNewSkipFolder] = useState('')
  const [minFileSize, setMinFileSize] = useState(1) // in MB
  const [scanProgress, setScanProgress] = useState<DuplicateScanProgress | null>(null)
  const [scanResult, setScanResult] = useState<DuplicateScanResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [backupValidation, setBackupValidation] = useState<BackupValidation | null>(null)

  // Load default skip folders on mount
  useEffect(() => {
    window.electronAPI.getDefaultSkipFolders().then(setSkipFolders)
  }, [])

  // Subscribe to scan progress events
  useEffect(() => {
    if (phase !== 'scanning') return
    const unsubscribe = window.electronAPI.onDuplicateScanProgress((progress) => {
      setScanProgress(progress)
    })
    return unsubscribe
  }, [phase])

  const handleSelectFolder = async () => {
    const folder = await window.electronAPI.selectSourceFolder()
    if (folder) setSourceFolder(folder)
  }

  const handleStartScan = async () => {
    if (!sourceFolder) return
    setPhase('scanning')
    setScanProgress(null)
    setScanError(null)
    setScanResult(null)
    setSelectedForRemoval(new Set())

    const config: DuplicateScanConfig = {
      sourceFolder,
      skipFolders,
      minFileSize: minFileSize * 1024 * 1024 // Convert MB to bytes
    }

    try {
      const result = await window.electronAPI.startDuplicateScan(config)
      setScanResult(result)
      // Auto-expand first few groups
      const autoExpand = new Set(result.groups.slice(0, 5).map(g => g.id))
      setExpandedGroups(autoExpand)
      setPhase('results')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed'
      if (message === 'Scan cancelled') {
        setPhase('config')
      } else {
        setScanError(message)
        setPhase('config')
      }
    }
  }

  const handleCancelScan = () => {
    window.electronAPI.cancelDuplicateScan()
  }

  const handleAddSkipFolder = () => {
    const trimmed = newSkipFolder.trim().toLowerCase()
    if (trimmed && !skipFolders.includes(trimmed)) {
      setSkipFolders(prev => [...prev, trimmed])
      setNewSkipFolder('')
    }
  }

  const handleRemoveSkipFolder = (folder: string) => {
    setSkipFolders(prev => prev.filter(f => f !== folder))
  }

  const handleToggleFile = (filePath: string) => {
    setSelectedForRemoval(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }

  const handleSelectAllDuplicates = () => {
    if (!scanResult) return
    const allNonKeepers = new Set<string>()
    for (const group of scanResult.groups) {
      for (let i = 0; i < group.files.length; i++) {
        if (i !== group.keeperIndex) {
          allNonKeepers.add(group.files[i].path)
        }
      }
    }
    setSelectedForRemoval(allNonKeepers)
  }

  const handleClearSelection = () => {
    setSelectedForRemoval(new Set())
  }

  const handleChangeKeeper = (groupId: string, newKeeperIndex: number) => {
    if (!scanResult) return
    setScanResult(prev => {
      if (!prev) return prev
      const groups = prev.groups.map(g => {
        if (g.id !== groupId) return g
        const files = g.files.map((f, i) => ({
          ...f,
          isKeeper: i === newKeeperIndex
        }))
        return { ...g, files, keeperIndex: newKeeperIndex }
      })
      return { ...prev, groups }
    })
    // Remove new keeper from selection, add old keeper if it was selected
    setSelectedForRemoval(prev => {
      const next = new Set(prev)
      const group = scanResult.groups.find(g => g.id === groupId)
      if (group) {
        next.delete(group.files[newKeeperIndex].path)
      }
      return next
    })
  }

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  // Calculate selection stats
  const selectionStats = useMemo(() => {
    if (!scanResult) return { count: 0, totalSize: 0 }
    let totalSize = 0
    for (const group of scanResult.groups) {
      for (const file of group.files) {
        if (selectedForRemoval.has(file.path)) {
          totalSize += group.fileSize
        }
      }
    }
    return { count: selectedForRemoval.size, totalSize }
  }, [selectedForRemoval, scanResult])

  // Build FileEntry[] for the removal workflow
  const handleStartTestRemoval = useCallback(() => {
    if (!backupLocation || !scanResult) return
    const entries: FileEntry[] = []
    for (const group of scanResult.groups) {
      for (const file of group.files) {
        if (selectedForRemoval.has(file.path)) {
          entries.push({
            path: file.path,
            size: group.fileSize,
            allocated: group.fileSize,
            modified: file.modified,
            attributes: ''
          })
        }
      }
    }
    onTestRemoval(entries, backupLocation)
  }, [backupLocation, scanResult, selectedForRemoval, onTestRemoval])

  const sourcePaths = useMemo(() => {
    return [...selectedForRemoval]
  }, [selectedForRemoval])

  const canStartTest = backupLocation && backupValidation?.isValid && !isTestLoading && selectionStats.count > 0

  const handleValidationChange = useCallback((validation: BackupValidation | null) => {
    setBackupValidation(validation)
  }, [])

  // ── Active test UI ────────────────────────────────────────────────────
  if (activeTest) {
    const testItems = activeTest.items.map(item => ({
      entry: item.entry,
      testItem: item
    })).sort((a, b) => b.entry.size - a.entry.size)

    const testTotalSize = testItems.reduce((sum, item) => sum + item.entry.size, 0)
    const renamedCount = activeTest.items.filter(i => i.status === 'renamed').length

    return (
      <div className="flex flex-col h-full">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-amber-800">
                Testing removal: {renamedCount} of {activeTest.items.length} duplicate{activeTest.items.length !== 1 ? 's' : ''} still disabled ({formatSize(testTotalSize)})
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Use your system normally. If something breaks, undo individual items or click "Undo All" to restore.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={onUndoTest}
                disabled={isTestLoading || renamedCount === 0}
                className="px-4 py-2 text-sm bg-white border border-amber-300 text-amber-700 rounded hover:bg-amber-50 disabled:opacity-50"
              >
                {isTestLoading ? 'Working...' : 'Undo All'}
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={isTestLoading || renamedCount === 0}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isTestLoading ? 'Working...' : 'Confirm & Delete'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {testItems.map(({ entry, testItem }) => (
              <DuplicateTestItem
                key={entry.path}
                entry={entry}
                status={testItem.status}
                renamedPath={testItem.renamedPath}
                backupPath={testItem.backupPath}
                error={testItem.error}
                onUndo={() => onUndoSingleItem(testItem.originalPath)}
                onDelete={() => onDeleteSingleItem(testItem.originalPath)}
                isLoading={isTestLoading}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Configuration UI ──────────────────────────────────────────────────
  if (phase === 'config') {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Find Duplicate Files</h2>
        <p className="text-sm text-gray-600 mb-6">
          Scans for duplicate media, documents, and archive files. Application data, caches, and system files are excluded for safety.
        </p>

        {scanError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-700">{scanError}</p>
          </div>
        )}

        {/* Source folder */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Source Folder</label>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 border rounded-md bg-gray-50 text-sm text-gray-700 truncate">
              {sourceFolder || 'No folder selected'}
            </div>
            <button
              onClick={handleSelectFolder}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Browse
            </button>
          </div>
        </div>

        {/* File types info */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm font-medium text-blue-800 mb-1">Safe file types only</p>
          <p className="text-xs text-blue-700">
            Images, video, audio, documents (PDF, Office), archives (ZIP, ISO), and installers (EXE, MSI).
            DLLs, config files, database files, and application data are never scanned.
          </p>
        </div>

        {/* Min file size */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Minimum File Size</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={1000}
              value={minFileSize}
              onChange={(e) => setMinFileSize(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 px-3 py-2 border rounded-md text-sm"
            />
            <span className="text-sm text-gray-600">MB</span>
          </div>
        </div>

        {/* Hard exclusions info */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Always excluded (built-in safety)</p>
          <div className="flex flex-wrap gap-1">
            {['AppData', 'ProgramData', 'Windows', 'Program Files', 'node_modules', '.git', 'Cache', '$Recycle.Bin'].map(folder => (
              <span key={folder} className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                {folder}
              </span>
            ))}
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded italic">
              + more
            </span>
          </div>
        </div>

        {/* Soft exclusions */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional skip folders</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newSkipFolder}
              onChange={(e) => setNewSkipFolder(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSkipFolder()}
              placeholder="Folder name to skip"
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
            <button
              onClick={handleAddSkipFolder}
              disabled={!newSkipFolder.trim()}
              className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {skipFolders.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skipFolders.map(folder => (
                <span key={folder} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                  {folder}
                  <button
                    onClick={() => handleRemoveSkipFolder(folder)}
                    className="text-amber-500 hover:text-amber-800"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Start button */}
        <button
          onClick={handleStartScan}
          disabled={!sourceFolder}
          className="w-full py-3 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Scan
        </button>
      </div>
    )
  }

  // ── Scanning UI ───────────────────────────────────────────────────────
  if (phase === 'scanning') {
    const progressPercent = scanProgress && scanProgress.totalFiles > 0
      ? Math.round((scanProgress.filesScanned / scanProgress.totalFiles) * 100)
      : 0

    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {scanProgress ? PHASE_LABELS[scanProgress.phase] || 'Scanning...' : 'Starting scan...'}
        </h2>

        {/* Progress bar */}
        <div className="w-full max-w-md mb-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress?.phase === 'sizing' ? 0 : progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        {scanProgress && (
          <div className="text-sm text-gray-600 space-y-1 text-center mb-6">
            <p>
              {scanProgress.filesScanned.toLocaleString()} files scanned
              {scanProgress.candidatesFound > 0 && (
                <> | {scanProgress.candidatesFound.toLocaleString()} candidates</>
              )}
              {scanProgress.duplicateGroupsFound > 0 && (
                <> | {scanProgress.duplicateGroupsFound} groups confirmed</>
              )}
            </p>
            {scanProgress.currentFile && (
              <p className="text-xs text-gray-400 truncate max-w-lg" title={scanProgress.currentFile}>
                {scanProgress.currentFile}
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleCancelScan}
          className="px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    )
  }

  // ── Results UI ────────────────────────────────────────────────────────
  if (phase === 'results' && scanResult) {
    if (scanResult.groups.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
          <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium">No duplicates found</p>
          <p className="text-sm mt-1">
            Scanned {scanResult.filesScanned.toLocaleString()} files in {formatDuration(scanResult.scanDuration)}
          </p>
          <button
            onClick={() => setPhase('config')}
            className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Back to configuration
          </button>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full">
        {/* Summary header */}
        <div className="bg-white border-b px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-medium text-gray-700">
                {scanResult.groups.length} duplicate group{scanResult.groups.length !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-500 ml-2">
                {formatSize(scanResult.totalDuplicateSize)} reclaimable
              </span>
              <span className="text-xs text-gray-400 ml-2">
                ({scanResult.filesScanned.toLocaleString()} files scanned in {formatDuration(scanResult.scanDuration)})
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPhase('config')}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                New Scan
              </button>
              {selectedForRemoval.size > 0 ? (
                <button
                  onClick={handleClearSelection}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Selection
                </button>
              ) : (
                <button
                  onClick={handleSelectAllDuplicates}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Select All Duplicates
                </button>
              )}
            </div>
          </div>

          {/* Selection stats + backup + test removal */}
          {selectionStats.count > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">
                  {selectionStats.count} file{selectionStats.count !== 1 ? 's' : ''} selected ({formatSize(selectionStats.totalSize)})
                </span>
              </div>
              <BackupLocationPanel
                backupLocation={backupLocation}
                onLocationChange={onBackupLocationChange}
                requiredBytes={selectionStats.totalSize}
                sourcePaths={sourcePaths}
                onValidationChange={handleValidationChange}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleStartTestRemoval}
                  disabled={!canStartTest}
                  className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!backupLocation ? 'Select a backup location first' : !backupValidation?.isValid ? 'Backup location validation failed' : ''}
                >
                  Test Removal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Duplicate groups list */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3">
            {scanResult.groups.map((group) => (
              <DuplicateGroupCard
                key={group.id}
                group={group}
                isExpanded={expandedGroups.has(group.id)}
                onToggle={() => handleToggleGroup(group.id)}
                selectedForRemoval={selectedForRemoval}
                onToggleFile={handleToggleFile}
                onChangeKeeper={(idx) => handleChangeKeeper(group.id, idx)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── Duplicate group card ──────────────────────────────────────────────────

interface DuplicateGroupCardProps {
  group: DuplicateGroup
  isExpanded: boolean
  onToggle: () => void
  selectedForRemoval: Set<string>
  onToggleFile: (path: string) => void
  onChangeKeeper: (index: number) => void
}

function DuplicateGroupCard({
  group,
  isExpanded,
  onToggle,
  selectedForRemoval,
  onToggleFile,
  onChangeKeeper
}: DuplicateGroupCardProps) {
  const fileName = group.files[0]?.path.split('\\').pop() || 'Unknown'
  const wastedSize = group.fileSize * (group.files.length - 1)
  const selectedCount = group.files.filter(f => selectedForRemoval.has(f.path)).length

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Group header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-800 truncate">{fileName}</span>
          <span className="text-xs text-gray-500 flex-shrink-0">{formatSize(group.fileSize)}</span>
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex-shrink-0">
            {group.files.length} copies
          </span>
          {selectedCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded flex-shrink-0">
              {selectedCount} selected
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500 flex-shrink-0 ml-2">
          {formatSize(wastedSize)} wasted
        </span>
      </button>

      {/* Expanded file list */}
      {isExpanded && (
        <div className="divide-y border-t">
          {group.files.map((file, index) => {
            const isKeeper = index === group.keeperIndex
            const isSelected = selectedForRemoval.has(file.path)

            return (
              <div
                key={file.path}
                className={`flex items-center gap-3 px-4 py-2 text-sm ${isKeeper ? 'bg-green-50' : 'hover:bg-gray-50'}`}
              >
                {/* Checkbox or keeper indicator */}
                {isKeeper ? (
                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleFile(file.path)}
                    className="w-4 h-4 flex-shrink-0"
                  />
                )}

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 truncate" title={file.path}>
                    {file.path}
                  </p>
                  <p className="text-xs text-gray-400">
                    Modified: {new Date(file.modified).toLocaleDateString()}
                  </p>
                </div>

                {/* Keeper badge or Make Keeper button */}
                {isKeeper ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex-shrink-0">
                    Keep
                  </span>
                ) : (
                  <button
                    onClick={() => onChangeKeeper(index)}
                    className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 flex-shrink-0"
                  >
                    Keep this
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Test item display (reuses MarkedTab pattern) ──────────────────────────

interface DuplicateTestItemProps {
  entry: FileEntry
  status: 'pending' | 'renamed' | 'restored' | 'deleted' | 'failed' | 'backed-up'
  renamedPath?: string
  backupPath?: string
  error?: string
  onUndo?: () => void
  onDelete?: () => void
  isLoading?: boolean
}

function DuplicateTestItem({ entry, status, renamedPath, backupPath, error, onUndo, onDelete, isLoading }: DuplicateTestItemProps) {
  const fileName = entry.path.split('\\').pop() || entry.path

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    'backed-up': 'bg-blue-100 text-blue-700',
    renamed: 'bg-amber-100 text-amber-700',
    restored: 'bg-green-100 text-green-700',
    deleted: 'bg-red-100 text-red-700',
    failed: 'bg-red-100 text-red-700'
  }

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    'backed-up': 'Backed Up',
    renamed: 'Disabled',
    restored: 'Restored',
    deleted: 'Deleted',
    failed: 'Failed'
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 truncate">{fileName}</span>
          <span className={`px-2 py-0.5 text-xs rounded ${statusColors[status]}`}>
            {statusLabels[status]}
          </span>
        </div>
        <p className="text-sm text-gray-500 truncate" title={entry.path}>
          {entry.path}
        </p>
        {status === 'renamed' && renamedPath && (
          <p className="text-xs text-amber-600 truncate mt-0.5" title={renamedPath}>
            Renamed to: {renamedPath.split('\\').pop()}
          </p>
        )}
        {backupPath && (
          <p className="text-xs text-blue-600 truncate mt-0.5" title={backupPath}>
            Backed up to: {backupPath}
          </p>
        )}
        {status === 'failed' && error && (
          <div className="mt-1">
            <p className="text-xs text-red-600">Error: {error}</p>
            {(error.includes('EPERM') || error.includes('EACCES') || error.includes('permission') || error.includes('Access')) && (
              <p className="text-xs text-red-500 mt-0.5">
                Tip: This file may require administrator privileges or is locked by an application.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0 flex items-center gap-2">
        <div className="font-medium text-gray-700">{formatSize(entry.size)}</div>
        {status === 'renamed' && onUndo && onDelete && (
          <>
            <button
              onClick={onUndo}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
              title="Restore this item"
            >
              Undo
            </button>
            <button
              onClick={onDelete}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
              title="Permanently delete this item"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}
