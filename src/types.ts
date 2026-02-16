// Risk scores 1-5
export type RiskScore = 1 | 2 | 3 | 4 | 5;

// Confidence levels
export type Confidence = 'high' | 'medium' | 'low';

// Analysis sources
export type AnalysisSource = 'offline-rule' | 'ai' | 'web-research';

// File entry from WizTree CSV
export interface FileEntry {
  path: string;
  size: number;
  allocated: number;
  modified: Date;
  attributes: string;
  files?: number;
  folders?: number;
}

// Path validation warnings
export interface PathWarning {
  type: 'junction' | 'symlink' | 'onedrive' | 'locale';
  message: string;
}

// Classification result
export interface Classification {
  riskScore: RiskScore;
  confidence: Confidence;
  category: string;
  recommendation: string;
  explanation: string;
  source: AnalysisSource;
  ruleId?: string;
  warnings: PathWarning[];
}

// Recommendation item combining file entry with classification
export interface RecommendationItem {
  entry: FileEntry;
  classification: Classification;
  potentialSavings: number;
}

// Tree node for hierarchical view
export interface TreeNode {
  name: string;
  path: string;
  size: number;
  children: TreeNode[];
  classification?: Classification;
  isExpanded?: boolean;
  depth: number;
  isRiskMatch?: boolean; // True if this node matches the current risk filter
}

// Audit log entry
export interface AuditEntry {
  timestamp: string;
  sessionId: string;
  path: string;
  size: number;
  riskScore: RiskScore;
  confidence: Confidence;
  recommendation: string;
  source: AnalysisSource;
  ruleId?: string;
  aiResponse?: string;
  webResearchSummary?: string;
}

// Web research types
export interface SourceResult {
  domain: string;
  title: string;
  url: string;
  snippet: string;
  trustLevel: 'official' | 'expert' | 'community';
  sentiment: 'safe' | 'dangerous' | 'conditional' | 'neutral';
  votes?: number;
  warnings?: string[];
}

export interface WebResearchResult {
  query: string;
  sources: SourceResult[];
  consensus: 'safe' | 'dangerous' | 'conditional' | 'conflicting' | 'insufficient';
  edgeCases: string[];
  confidenceAdjustment: -1 | 0 | 1;
  summary: string;
  cachedAt: string;
}

// Problem report
export interface ProblemReport {
  timestamp: string;
  path: string;
  classification: Classification;
  problemType: 'data-loss' | 'app-problems' | 'misidentified' | 'unclear' | 'other';
  details?: string;
}

// App state
export interface AppState {
  phase: 'start' | 'results';
  safetyConfirmed: boolean;
  entries: FileEntry[];
  recommendations: RecommendationItem[];
  tree: TreeNode | null;
  selectedNode: TreeNode | null;
  selectedItem: RecommendationItem | null;
  isLoading: boolean;
  error: string | null;
}

// Removal test types
export type RemovalTestPhase = 'selecting' | 'testing' | 'confirmed';

export interface RemovalTestItem {
  entry: FileEntry;
  included: boolean;
  originalPath: string;
  renamedPath?: string;
  backupPath?: string;
  status: 'pending' | 'renamed' | 'restored' | 'deleted' | 'failed' | 'backed-up';
  error?: string;
}

export interface RemovalTestJob {
  jobId: string;
  items: RemovalTestItem[];
  phase: RemovalTestPhase;
  createdAt: string;
  completedAt?: string;
  totalBytes: number;
  backupLocation?: string;
}

// Backup validation result
export interface BackupValidation {
  isValid: boolean;
  availableSpace: number;
  requiredSpace: number;
  warning?: string;
  error?: string;
}

// AI Advisor types

export interface SystemAction {
  id: string;
  name: string;
  command: string;
  explanation: string;
  estimatedSavings: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AdvisorItemReference {
  path: string;
  size: number;
  reason: string;
}

export interface AdvisorCategory {
  type: 'disksage' | 'system' | 'investigate' | 'external';
  title: string;
  description: string;
  items?: AdvisorItemReference[];
  actions?: SystemAction[];
  guidance?: string;
  totalSize?: number;
}

export interface AdvisorPlan {
  categories: AdvisorCategory[];
  summary: string;
  createdAt: string;
}

// Duplicate finder types

export interface DuplicateFile {
  path: string;
  modified: Date;
  isKeeper: boolean;
}

export interface DuplicateGroup {
  id: string;
  hash: string;
  fileSize: number;
  files: DuplicateFile[];
  keeperIndex: number;
}

export interface DuplicateScanConfig {
  sourceFolder: string;
  skipFolders: string[];
  minFileSize: number;
}

export type DuplicateScanPhase = 'sizing' | 'partial-hash' | 'full-hash' | 'complete';

export interface DuplicateScanProgress {
  phase: DuplicateScanPhase;
  filesScanned: number;
  totalFiles: number;
  candidatesFound: number;
  duplicateGroupsFound: number;
  currentFile?: string;
}

export interface DuplicateScanResult {
  groups: DuplicateGroup[];
  totalDuplicateSize: number;
  scanDuration: number;
  filesScanned: number;
}
