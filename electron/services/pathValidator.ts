import fs from 'fs/promises'
import path from 'path'
import type { PathWarning } from '../../src/types'

/**
 * Validate a path and return warnings about special conditions.
 * This is CRITICAL for safety - junction points, symlinks, and OneDrive
 * paths can lead to unexpected data loss if not handled carefully.
 */
export async function validatePath(pathToCheck: string): Promise<{
  isValid: boolean
  warnings: PathWarning[]
  resolvedPath: string | null
}> {
  const warnings: PathWarning[] = []

  try {
    // Check if path exists
    const stats = await fs.lstat(pathToCheck)

    // Check for symbolic links
    if (stats.isSymbolicLink()) {
      try {
        const realPath = await fs.realpath(pathToCheck)
        warnings.push({
          type: 'symlink',
          message: `This is a symbolic link pointing to: ${realPath}. Deleting here affects the target location.`
        })
      } catch {
        warnings.push({
          type: 'symlink',
          message: 'This is a symbolic link but the target could not be resolved. Exercise caution.'
        })
      }
    }

    // Check for junction points (Windows-specific reparse points)
    // Junction points have the reparse point attribute
    if (process.platform === 'win32' && isJunctionPoint(pathToCheck)) {
      warnings.push({
        type: 'junction',
        message: 'This folder is a junction point (Windows folder redirect). Deleting may affect another location.'
      })
    }

    // Check for OneDrive paths
    if (isOneDrivePath(pathToCheck)) {
      warnings.push({
        type: 'onedrive',
        message: 'This folder syncs with OneDrive. Deleting here will also delete from the cloud.'
      })
    }

    return {
      isValid: true,
      warnings,
      resolvedPath: await fs.realpath(pathToCheck).catch(() => pathToCheck)
    }
  } catch (err) {
    return {
      isValid: false,
      warnings: [],
      resolvedPath: null
    }
  }
}

/**
 * Check if a path is a Windows junction point.
 * Junction points are directory-level symbolic links.
 */
function isJunctionPoint(pathToCheck: string): boolean {
  // Common junction points in Windows
  const commonJunctions = [
    'Application Data',
    'Local Settings',
    'My Documents',
    'Start Menu',
    'Templates',
    'SendTo',
    'NetHood',
    'PrintHood'
  ]

  const basename = path.basename(pathToCheck)
  return commonJunctions.includes(basename)
}

/**
 * Check if a path is within OneDrive.
 */
export function isOneDrivePath(pathToCheck: string): boolean {
  const normalised = pathToCheck.toLowerCase().replace(/\//g, '\\')
  return normalised.includes('\\onedrive\\') ||
         normalised.includes('\\onedrive -')
}

/**
 * Get locale-aware folder names for Documents, Pictures, etc.
 * This helps correctly identify user folders in non-English Windows.
 */
export function getLocalisedFolderNames(): Record<string, string[]> {
  return {
    documents: [
      'Documents', 'Dokumente', 'Documentos', 'Documenti',
      'My Documents', 'Meus documentos', 'Mes documents'
    ],
    pictures: [
      'Pictures', 'Bilder', 'Images', 'Imágenes', 'Immagini',
      'My Pictures', 'Minhas imagens', 'Mes images'
    ],
    downloads: [
      'Downloads', 'Téléchargements', 'Descargas', 'Download'
    ],
    videos: [
      'Videos', 'Vídeos', 'Vidéos', 'Video'
    ],
    desktop: [
      'Desktop', 'Área de trabalho', 'Bureau', 'Escritorio'
    ]
  }
}

/**
 * Check if a path matches a user folder pattern across locales.
 */
export function matchesUserFolder(
  pathToCheck: string,
  folderType: keyof ReturnType<typeof getLocalisedFolderNames>
): boolean {
  const names = getLocalisedFolderNames()[folderType]
  const normalised = pathToCheck.toLowerCase().replace(/\//g, '\\')

  for (const name of names) {
    if (normalised.includes(`\\${name.toLowerCase()}\\`) ||
        normalised.endsWith(`\\${name.toLowerCase()}`)) {
      return true
    }
  }

  return false
}
