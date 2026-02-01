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
