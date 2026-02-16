import type { SystemAction } from '../../src/types'

/**
 * Catalogue of known Windows system cleanup actions.
 * These are referenced by the AI advisor when appropriate.
 */
export const SYSTEM_ACTIONS: Record<string, SystemAction> = {
  'dism-cleanup': {
    id: 'dism-cleanup',
    name: 'DISM Component Store Cleanup',
    command: 'Dism /Online /Cleanup-Image /StartComponentCleanup',
    explanation: 'Removes old Windows component versions kept for rollback. Safe but preserves recent updates. Run as Administrator.',
    estimatedSavings: '2-10 GB',
    riskLevel: 'low'
  },

  'dism-resetbase': {
    id: 'dism-resetbase',
    name: 'DISM Component Store Cleanup (Aggressive)',
    command: 'Dism /Online /Cleanup-Image /StartComponentCleanup /ResetBase',
    explanation: 'Removes all old component versions. Frees more space but removes rollback ability for old updates. Run as Administrator.',
    estimatedSavings: '5-20 GB',
    riskLevel: 'medium'
  },

  'disk-cleanup': {
    id: 'disk-cleanup',
    name: 'Windows Disk Cleanup — Configure',
    command: 'cleanmgr /sageset:1',
    explanation: 'Opens the Disk Cleanup configuration dialog. Tick everything (especially Windows Update Cleanup) and click OK to save your selections.',
    estimatedSavings: '5-30 GB',
    riskLevel: 'low'
  },

  'disk-cleanup-run': {
    id: 'disk-cleanup-run',
    name: 'Windows Disk Cleanup — Execute',
    command: 'cleanmgr /sagerun:1',
    explanation: 'Runs the Disk Cleanup with the selections you saved above. This performs the actual deletion.',
    estimatedSavings: '5-30 GB',
    riskLevel: 'low'
  },

  'hibernation-off': {
    id: 'hibernation-off',
    name: 'Disable Hibernation',
    command: 'powercfg /hibernation off',
    explanation: 'Deletes hiberfil.sys which equals your RAM size. Sleep mode still works without it. Re-enable anytime with: powercfg /hibernation on. Run as Administrator.',
    estimatedSavings: '8-32 GB',
    riskLevel: 'low'
  },

  'temp-cleanup': {
    id: 'temp-cleanup',
    name: 'Clear Temp Folders',
    command: 'Remove-Item "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item "C:\\Windows\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue',
    explanation: 'Deletes temporary files from user and system temp folders. Safe to run anytime. Some files in use will be skipped automatically.',
    estimatedSavings: '0.5-5 GB',
    riskLevel: 'low'
  },

  'npm-cache-clear': {
    id: 'npm-cache-clear',
    name: 'Clear npm Cache',
    command: 'npm cache clean --force',
    explanation: 'Clears the npm package manager cache. Packages are re-downloaded automatically when needed.',
    estimatedSavings: '0.5-5 GB',
    riskLevel: 'low'
  },

  'pip-cache-purge': {
    id: 'pip-cache-purge',
    name: 'Clear pip Cache',
    command: 'pip cache purge',
    explanation: 'Clears the Python pip package cache. Packages are re-downloaded automatically when needed.',
    estimatedSavings: '0.5-3 GB',
    riskLevel: 'low'
  },

  'nuget-cache-clear': {
    id: 'nuget-cache-clear',
    name: 'Clear NuGet Cache',
    command: 'dotnet nuget locals all --clear',
    explanation: 'Clears the .NET NuGet package cache. Packages are re-downloaded automatically when building projects.',
    estimatedSavings: '0.5-3 GB',
    riskLevel: 'low'
  }
}

/**
 * Get all system actions as an array
 */
export function getAllSystemActions(): SystemAction[] {
  return Object.values(SYSTEM_ACTIONS)
}
