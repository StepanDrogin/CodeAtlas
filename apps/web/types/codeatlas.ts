import type {
  ArchitectureNode,
  PullRequest,
  PullRequestReview,
  RepositoryAnalysis,
  RepositoryMeta,
  RiskLevel,
  ReviewCommentSuggestion,
  SourceReference,
  SummaryItem
} from '@codeatlas/analyzer'

export type {
  ArchitectureNode,
  PullRequest,
  PullRequestReview,
  RepositoryAnalysis,
  RepositoryMeta,
  RiskLevel,
  ReviewCommentSuggestion,
  SourceReference,
  SummaryItem
}

export type NavSection =
  | 'repository'
  | 'architecture'
  | 'ask'
  | 'pr-review'
  | 'observability'
  | 'bookmarks'
  | 'reports'
  | 'integrations'
  | 'settings'

export interface NavItem {
  id: NavSection
  label: string
  icon: string
}

export interface Metric {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  tone: 'good' | 'warn'
  points: number[]
}

export interface AnalysisStep {
  id: string
  label: string
  detail: string
  status: 'complete' | 'active' | 'pending' | 'failed'
}

export interface HealthSegment {
  label: string
  score: number
  value: string
  detail: string
  tone: 'good' | 'watch' | 'risk'
}

export interface InsightItem {
  id: string
  label: string
  detail: string
  tone: 'good' | 'info' | 'warning' | 'risk'
  section?: NavSection
  action?: string
}

export interface RecentAnalysis {
  id: string
  repository: string
  description: string
  score: number
  healthLabel: string
  analyzedAt: string
  meta: string
}

export interface WorkspaceSetupStep {
  id: string
  label: string
  detail: string
  status: 'done' | 'active' | 'pending'
  action: string
}

export interface AiSessionItem {
  id: string
  question: string
  answer: string
  confidence: number
  references: SourceReference[]
  askedAt: string
  mode: 'gemini' | 'fallback' | 'demo'
}

export type SavedReferencePriority = 'Critical path' | 'Architecture' | 'API boundary' | 'Review context' | 'Watch'

export interface SavedReference extends SourceReference {
  priority: SavedReferencePriority
  note: string
  savedAt: string
}
