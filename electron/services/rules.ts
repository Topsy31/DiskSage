import type { RiskScore, Confidence } from '../../src/types'

export interface Rule {
  id: string
  pattern: RegExp
  category: string
  riskScore: RiskScore
  confidence: Confidence
  recommendation: string
  explanation: string
  // If true, prevents matching lower-priority rules
  exclusive?: boolean
}

/**
 * IMPORTANT: Rules are ordered by specificity.
 * More specific patterns should come BEFORE general patterns.
 * Never use overly broad patterns that could match user-created folders.
 */
export const rules: Rule[] = [
  // ============================================================
  // RISK 5 (CRITICAL) - System files, never recommend deletion
  // ============================================================
  {
    id: 'windows-system32',
    pattern: /^[A-Z]:\\Windows\\System32\\/i,
    category: 'Windows System',
    riskScore: 5,
    confidence: 'high',
    recommendation: 'Do not delete - core Windows files',
    explanation: 'These are core Windows system files. Deleting them will break your computer.',
    exclusive: true
  },
  {
    id: 'windows-syswow64',
    pattern: /^[A-Z]:\\Windows\\SysWOW64\\/i,
    category: 'Windows System (32-bit)',
    riskScore: 5,
    confidence: 'high',
    recommendation: 'Do not delete - core Windows files',
    explanation: 'These are Windows system files for running 32-bit applications. Required for compatibility.',
    exclusive: true
  },
  {
    id: 'windows-winsxs',
    pattern: /^[A-Z]:\\Windows\\WinSxS\\/i,
    category: 'Windows Components',
    riskScore: 5,
    confidence: 'high',
    recommendation: 'Do not delete - shared libraries',
    explanation: 'Side-by-side assemblies folder. Appears large but Windows manages it automatically. Use Disk Cleanup if needed.',
    exclusive: true
  },
  {
    id: 'program-files',
    pattern: /^[A-Z]:\\Program Files\\/i,
    category: 'Installed Applications',
    riskScore: 5,
    confidence: 'high',
    recommendation: 'Do not delete - uninstall via Settings instead',
    explanation: 'Installed applications. To remove, use Settings > Apps > Installed Apps to uninstall properly.',
    exclusive: true
  },
  {
    id: 'program-files-x86',
    pattern: /^[A-Z]:\\Program Files \(x86\)\\/i,
    category: 'Installed Applications (32-bit)',
    riskScore: 5,
    confidence: 'high',
    recommendation: 'Do not delete - uninstall via Settings instead',
    explanation: 'Installed 32-bit applications. To remove, use Settings > Apps > Installed Apps.',
    exclusive: true
  },
  {
    id: 'programdata',
    pattern: /^[A-Z]:\\ProgramData\\/i,
    category: 'Application Data',
    riskScore: 5,
    confidence: 'high',
    recommendation: 'Do not delete - application configuration and data',
    explanation: 'Shared application data. Deleting can break installed applications.',
    exclusive: true
  },
  {
    id: 'recovery',
    pattern: /^[A-Z]:\\Recovery\\/i,
    category: 'Windows Recovery',
    riskScore: 5,
    confidence: 'high',
    recommendation: 'Do not delete - Windows recovery files',
    explanation: 'Windows recovery partition files. Required to repair or reset Windows.',
    exclusive: true
  },
  {
    id: 'system-volume-info',
    pattern: /^[A-Z]:\\System Volume Information\\/i,
    category: 'System Restore',
    riskScore: 5,
    confidence: 'high',
    recommendation: 'Do not delete - manage via System Properties',
    explanation: 'Contains restore points and system protection data. Manage via System Properties if needed.',
    exclusive: true
  },
  {
    id: 'recycle-bin',
    pattern: /^[A-Z]:\\\$Recycle\.Bin\\/i,
    category: 'Recycle Bin',
    riskScore: 5,
    confidence: 'high',
    recommendation: 'Use "Empty Recycle Bin" instead',
    explanation: 'This is the Recycle Bin. Right-click on Desktop Recycle Bin icon to empty it safely.',
    exclusive: true
  },

  // ============================================================
  // RISK 4 (HIGH) - Personal files, backup required
  // ============================================================
  {
    id: 'user-documents',
    pattern: /^[A-Z]:\\Users\\[^\\]+\\Documents\\/i,
    category: 'Documents',
    riskScore: 4,
    confidence: 'high',
    recommendation: 'Backup required - contains personal files',
    explanation: 'Your Documents folder contains personal files. Never delete without a verified backup.',
    exclusive: true
  },
  {
    id: 'user-desktop',
    pattern: /^[A-Z]:\\Users\\[^\\]+\\Desktop\\/i,
    category: 'Desktop',
    riskScore: 4,
    confidence: 'high',
    recommendation: 'Backup required - often contains important files',
    explanation: 'Desktop often contains important files and shortcuts. Review carefully before any action.',
    exclusive: true
  },
  {
    id: 'user-pictures',
    pattern: /^[A-Z]:\\Users\\[^\\]+\\Pictures\\/i,
    category: 'Pictures',
    riskScore: 4,
    confidence: 'high',
    recommendation: 'Backup required - personal memories',
    explanation: 'Your photos and images. These are irreplaceable. Never delete without a verified backup.',
    exclusive: true
  },
  {
    id: 'user-videos',
    pattern: /^[A-Z]:\\Users\\[^\\]+\\Videos\\/i,
    category: 'Videos',
    riskScore: 4,
    confidence: 'high',
    recommendation: 'Backup required - personal videos',
    explanation: 'Your video files. These are often irreplaceable. Never delete without a verified backup.',
    exclusive: true
  },
  {
    id: 'onedrive',
    pattern: /^[A-Z]:\\Users\\[^\\]+\\OneDrive/i,
    category: 'OneDrive',
    riskScore: 4,
    confidence: 'high',
    recommendation: 'Warning: cloud-synced folder',
    explanation: 'This folder syncs with OneDrive cloud. Deleting files here will ALSO delete them from your cloud storage.',
    exclusive: true
  },

  // ============================================================
  // RISK 3 (MEDIUM) - Requires review
  // ============================================================
  {
    id: 'windows-installer',
    pattern: /^[A-Z]:\\Windows\\Installer\\/i,
    category: 'Windows Patches',
    riskScore: 3,
    confidence: 'medium',
    recommendation: 'Requires special tool - do not delete directly',
    explanation: 'Contains Windows and application patches. Manual deletion can break program repair/uninstall. Use PatchCleaner or similar specialised tools.',
    exclusive: true
  },
  {
    id: 'user-downloads',
    pattern: /^[A-Z]:\\Users\\[^\\]+\\Downloads\\/i,
    category: 'Downloads',
    riskScore: 3,
    confidence: 'medium',
    recommendation: 'Review contents - may contain important files',
    explanation: 'Your Downloads folder. May contain important files mixed with installers. Review contents individually.',
    exclusive: true
  },
  {
    id: 'sql-installer',
    pattern: /^[A-Z]:\\SQL\d+\\/i,
    category: 'SQL Server Installation Media',
    riskScore: 3,
    confidence: 'medium',
    recommendation: 'Probably safe if SQL Server is installed and working',
    explanation: 'SQL Server installation files. Usually safe to remove after installation, but keep if you might need to repair/modify the installation.',
    exclusive: true
  },

  // ============================================================
  // RISK 2 (LOW-MEDIUM) - Usually safe, verify first
  // ============================================================
  {
    id: 'node-modules',
    pattern: /\\node_modules\\/i,
    category: 'JavaScript Packages',
    riskScore: 2,
    confidence: 'high',
    recommendation: 'Usually safe - recreate with npm install',
    explanation: 'Downloaded JavaScript packages. Can be recreated by running "npm install" in the project folder.',
    exclusive: false
  },
  {
    id: 'python-pycache',
    pattern: /\\__pycache__\\/i,
    category: 'Python Cache',
    riskScore: 2,
    confidence: 'high',
    recommendation: 'Usually safe - recreated automatically',
    explanation: 'Compiled Python bytecode. Recreated automatically when Python runs.',
    exclusive: false
  },
  {
    id: 'nuget-packages',
    pattern: /\\.nuget\\packages\\/i,
    category: '.NET Packages',
    riskScore: 2,
    confidence: 'high',
    recommendation: 'Usually safe - recreate by building project',
    explanation: 'Downloaded .NET packages. Can be recreated by building the project.',
    exclusive: false
  },
  {
    id: 'npm-cache',
    pattern: /\\.npm\\_cacache\\/i,
    category: 'NPM Cache',
    riskScore: 2,
    confidence: 'high',
    recommendation: 'Usually safe - package manager cache',
    explanation: 'NPM package cache. Can be safely cleared with "npm cache clean --force".',
    exclusive: false
  },
  {
    id: 'hp-swsetup',
    pattern: /^[A-Z]:\\SWSETUP\\/i,
    category: 'HP Driver Installers',
    riskScore: 2,
    confidence: 'medium',
    recommendation: 'Probably safe - driver installation files',
    explanation: 'HP pre-installed driver packages. Usually safe after initial setup, but keep if you might need to reinstall drivers.',
    exclusive: true
  },

  // ============================================================
  // RISK 1 (LOW) - Typically safe
  // ============================================================
  {
    id: 'windows-temp',
    pattern: /^[A-Z]:\\Windows\\Temp\\/i,
    category: 'Windows Temporary',
    riskScore: 1,
    confidence: 'high',
    recommendation: 'Typically safe - system temporary files',
    explanation: 'System temporary files. Windows clears these periodically. Use Disk Cleanup for safe removal.',
    exclusive: true
  },
  {
    id: 'user-temp',
    pattern: /^[A-Z]:\\Users\\[^\\]+\\AppData\\Local\\Temp\\/i,
    category: 'User Temporary',
    riskScore: 1,
    confidence: 'high',
    recommendation: 'Typically safe - temporary files',
    explanation: 'Your temporary files. Applications create these during operation. Safe to clear when applications are closed.',
    exclusive: true
  },
  {
    id: 'chrome-cache',
    pattern: /\\Google\\Chrome\\User Data\\[^\\]+\\Cache\\/i,
    category: 'Chrome Browser Cache',
    riskScore: 1,
    confidence: 'high',
    recommendation: 'Typically safe - rebuilds automatically',
    explanation: 'Chrome browser cache. Speeds up browsing but rebuilds automatically. Clear via Chrome settings for safer removal.',
    exclusive: true
  },
  {
    id: 'firefox-cache',
    pattern: /\\Mozilla\\Firefox\\Profiles\\[^\\]+\\cache2\\/i,
    category: 'Firefox Browser Cache',
    riskScore: 1,
    confidence: 'high',
    recommendation: 'Typically safe - rebuilds automatically',
    explanation: 'Firefox browser cache. Speeds up browsing but rebuilds automatically.',
    exclusive: true
  },
  {
    id: 'edge-cache',
    pattern: /\\Microsoft\\Edge\\User Data\\[^\\]+\\Cache\\/i,
    category: 'Edge Browser Cache',
    riskScore: 1,
    confidence: 'high',
    recommendation: 'Typically safe - rebuilds automatically',
    explanation: 'Edge browser cache. Speeds up browsing but rebuilds automatically.',
    exclusive: true
  },
  {
    id: 'office-temp',
    pattern: /~\$[^\\]+$/i,
    category: 'Office Temporary',
    riskScore: 1,
    confidence: 'medium',
    recommendation: 'Typically safe if document is closed',
    explanation: 'Office temporary file. Safe to delete if the corresponding document is not open.',
    exclusive: false
  },

  // ============================================================
  // GENERIC CACHE (Lower confidence - must not match user folders)
  // ============================================================
  {
    id: 'generic-cache-appdata',
    pattern: /\\AppData\\[^\\]+\\[^\\]+\\[^\\]+\\Cache\\/i,
    category: 'Application Cache',
    riskScore: 1,
    confidence: 'medium',
    recommendation: 'Probably safe - application cache',
    explanation: 'Application cache folder. Usually safe to clear, but verify this is not a folder you created.',
    exclusive: false
  }
]

/**
 * Find the first matching rule for a path.
 * Returns undefined if no rule matches.
 */
export function findMatchingRule(path: string): Rule | undefined {
  for (const rule of rules) {
    if (rule.pattern.test(path)) {
      return rule
    }
  }
  return undefined
}

/**
 * Check if a path should NOT match a specific rule.
 * Used for negative test cases.
 */
export function shouldNotMatch(path: string, ruleId: string): boolean {
  const matchedRule = findMatchingRule(path)
  return matchedRule?.id !== ruleId
}
