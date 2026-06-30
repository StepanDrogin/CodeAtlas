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
