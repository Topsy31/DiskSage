import type { FileEntry, TreeNode, Classification } from '../types'

/**
 * Build a tree structure from flat file entries.
 * Groups by path hierarchy and calculates sizes.
 */
export function buildTree(
  entries: FileEntry[],
  classifyFn: (path: string) => Classification | undefined
): TreeNode {
  // Find the root (usually the drive like C:\)
  const rootPath = findCommonRoot(entries)

  const root: TreeNode = {
    name: rootPath,
    path: rootPath,
    size: 0,
    children: [],
    depth: 0
  }

  // Build path -> entry map for size lookup
  const entryMap = new Map<string, FileEntry>()
  for (const entry of entries) {
    entryMap.set(entry.path.toLowerCase(), entry)
  }

  // Build path -> node map for quick lookups
  const nodeMap = new Map<string, TreeNode>()
  nodeMap.set(rootPath.toLowerCase(), root)

  // Sort entries by path depth (shorter paths first)
  const sortedEntries = [...entries].sort((a, b) => {
    const depthA = a.path.split('\\').length
    const depthB = b.path.split('\\').length
    return depthA - depthB
  })

  for (const entry of sortedEntries) {
    // Normalise path - remove trailing backslash
    const normPath = entry.path.replace(/\\$/, '')
    const pathParts = normPath.split('\\').filter(p => p)

    let currentPath = ''
    let parentNode = root

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]

      // Build the current path
      if (i === 0 && part.match(/^[A-Z]:$/i)) {
        currentPath = part + '\\'
      } else if (currentPath.endsWith('\\')) {
        currentPath = currentPath + part
      } else {
        currentPath = currentPath + '\\' + part
      }

      const normCurrentPath = currentPath.toLowerCase()
      let node = nodeMap.get(normCurrentPath)

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          size: 0,
          children: [],
          depth: i
        }
        nodeMap.set(normCurrentPath, node)
        parentNode.children.push(node)
      }

      // If this matches the entry's path, set size and classification
      if (normCurrentPath === normPath.toLowerCase()) {
        node.size = entry.size
        node.classification = classifyFn(entry.path)
      }

      parentNode = node
    }
  }

  // Sort children by size at each level
  sortChildrenBySize(root)

  // Calculate root size as sum of direct children
  root.size = root.children.reduce((sum, child) => sum + child.size, 0)

  return root
}

/**
 * Find the common root path of all entries.
 */
function findCommonRoot(entries: FileEntry[]): string {
  if (entries.length === 0) return 'C:\\'

  // Get first path's drive letter
  const firstPath = entries[0].path
  const driveMatch = firstPath.match(/^([A-Z]:)/i)

  return driveMatch ? driveMatch[1] + '\\' : 'C:\\'
}

/**
 * Recursively sort children by size (largest first).
 */
function sortChildrenBySize(node: TreeNode): void {
  node.children.sort((a, b) => b.size - a.size)
  for (const child of node.children) {
    sortChildrenBySize(child)
  }
}

/**
 * Get flattened visible nodes based on expansion state.
 */
export function getVisibleNodes(root: TreeNode, expandedPaths: Set<string>): TreeNode[] {
  const result: TreeNode[] = []

  function traverse(node: TreeNode, depth: number) {
    result.push({ ...node, depth })

    if (expandedPaths.has(node.path)) {
      for (const child of node.children) {
        traverse(child, depth + 1)
      }
    }
  }

  // Start with root's children (don't show the root drive itself as expandable)
  for (const child of root.children) {
    traverse(child, 0)
  }

  return result
}

/**
 * Format bytes to human-readable size.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[Math.min(i, units.length - 1)]}`
}

/**
 * Calculate percentage of parent.
 */
export function getPercentOfParent(node: TreeNode, parentSize: number): number {
  if (parentSize === 0) return 0
  return Math.round((node.size / parentSize) * 100)
}

/**
 * Build a tree filtered by risk level from recommendations.
 * Only includes paths that have classifications matching the filter.
 */
export function buildRiskFilteredTree(
  entries: FileEntry[],
  classificationMap: Map<string, Classification>,
  riskFilter: (classification: Classification) => boolean,
  excludePaths: Set<string>
): TreeNode {
  // Find entries that match the risk filter
  const matchingPaths = new Set<string>()

  for (const entry of entries) {
    const normPath = entry.path.toLowerCase()
    if (excludePaths.has(normPath)) continue

    const classification = classificationMap.get(normPath)
    if (classification && riskFilter(classification)) {
      matchingPaths.add(normPath)
    }
  }

  // Build ancestor paths for all matching entries
  const relevantPaths = new Set<string>()
  for (const pathLower of matchingPaths) {
    relevantPaths.add(pathLower)
    // Add all ancestor paths
    const parts = pathLower.split('\\').filter(p => p)
    let currentPath = ''
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (i === 0 && part.match(/^[a-z]:$/i)) {
        currentPath = part + '\\'
      } else if (currentPath.endsWith('\\')) {
        currentPath = currentPath + part
      } else {
        currentPath = currentPath + '\\' + part
      }
      relevantPaths.add(currentPath.toLowerCase())
    }
  }

  // Build the tree with only relevant paths
  const rootPath = findCommonRootFromPaths(matchingPaths)

  const root: TreeNode = {
    name: rootPath,
    path: rootPath,
    size: 0,
    children: [],
    depth: 0
  }

  const nodeMap = new Map<string, TreeNode>()
  nodeMap.set(rootPath.toLowerCase(), root)

  // Build entry map for size lookup
  const entryMap = new Map<string, FileEntry>()
  for (const entry of entries) {
    entryMap.set(entry.path.toLowerCase(), entry)
  }

  // Sort matching entries by path depth
  const matchingEntries = entries.filter(e => matchingPaths.has(e.path.toLowerCase()))
  const sortedEntries = [...matchingEntries].sort((a, b) => {
    const depthA = a.path.split('\\').length
    const depthB = b.path.split('\\').length
    return depthA - depthB
  })

  for (const entry of sortedEntries) {
    const normPath = entry.path.replace(/\\$/, '')
    const pathParts = normPath.split('\\').filter(p => p)

    let currentPath = ''
    let parentNode = root

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]

      if (i === 0 && part.match(/^[A-Z]:$/i)) {
        currentPath = part + '\\'
      } else if (currentPath.endsWith('\\')) {
        currentPath = currentPath + part
      } else {
        currentPath = currentPath + '\\' + part
      }

      const normCurrentPath = currentPath.toLowerCase()
      let node = nodeMap.get(normCurrentPath)

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          size: 0,
          children: [],
          depth: i,
          isRiskMatch: matchingPaths.has(normCurrentPath)
        }
        nodeMap.set(normCurrentPath, node)
        parentNode.children.push(node)
      }

      // Set size and classification for matching entries
      if (matchingPaths.has(normCurrentPath)) {
        node.size = entry.size
        node.classification = classificationMap.get(normCurrentPath)
        node.isRiskMatch = true
      }

      parentNode = node
    }
  }

  // Sort children by size
  sortChildrenBySize(root)

  // Calculate root size as sum of direct children
  root.size = root.children.reduce((sum, child) => sum + child.size, 0)

  return root
}

/**
 * Find common root from a set of paths.
 */
function findCommonRootFromPaths(paths: Set<string>): string {
  if (paths.size === 0) return 'C:\\'

  const firstPath = paths.values().next().value
  if (!firstPath) return 'C:\\'
  const driveMatch = firstPath.match(/^([a-z]:)/i)

  return driveMatch ? driveMatch[1].toUpperCase() + '\\' : 'C:\\'
}

/**
 * Deduplicate paths - remove children when parent is selected.
 * Returns the set of root-level paths (no ancestors in the set).
 */
export function deduplicatePaths(paths: Set<string>): Set<string> {
  const result = new Set<string>()

  // Sort paths by length (shortest first = potential parents)
  const sortedPaths = Array.from(paths).sort((a, b) => a.length - b.length)

  for (const path of sortedPaths) {
    // Check if any existing path is an ancestor of this one
    let hasAncestor = false
    for (const existing of result) {
      if (path.toLowerCase().startsWith(existing.toLowerCase() + '\\')) {
        hasAncestor = true
        break
      }
    }
    if (!hasAncestor) {
      result.add(path)
    }
  }

  return result
}

/**
 * Calculate deduplicated total size from entries.
 * Excludes children when parent is already in the set.
 */
export function calculateDeduplicatedSize(
  paths: Set<string>,
  getSize: (path: string) => number
): { totalSize: number; rootPaths: Set<string>; excludedCount: number } {
  const rootPaths = deduplicatePaths(paths)
  let totalSize = 0

  for (const path of rootPaths) {
    totalSize += getSize(path.toLowerCase())
  }

  return {
    totalSize,
    rootPaths,
    excludedCount: paths.size - rootPaths.size
  }
}
