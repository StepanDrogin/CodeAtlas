import type {
  ArchitectureNode,
  Metric,
  NavItem,
  PullRequest,
  PullRequestReview,
  SourceReference,
  SummaryItem
} from '~/types/codeatlas'

export const navItems: NavItem[] = [
  { id: 'repository', label: 'Repository', icon: 'repository' },
  { id: 'architecture', label: 'Architecture', icon: 'architecture' },
  { id: 'ask', label: 'Ask CodeAtlas', icon: 'ask' },
  { id: 'pr-review', label: 'PR Review', icon: 'review' },
  { id: 'observability', label: 'Observability', icon: 'observability' },
  { id: 'bookmarks', label: 'Bookmarks', icon: 'bookmarks' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'integrations', label: 'Integrations', icon: 'integrations' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
]

export const architectureNodes: ArchitectureNode[] = [
  {
    id: 'web',
    label: 'Web',
    detail: 'Nuxt dashboard',
    kind: 'api',
    column: 'entry'
  },
  {
    id: 'gateway',
    label: 'API Gateway',
    detail: 'Fastify',
    kind: 'service',
    column: 'backend'
  },
  {
    id: 'auth',
    label: 'Auth Service',
    detail: 'OAuth scopes',
    kind: 'service',
    column: 'backend'
  },
  {
    id: 'analyzer',
    label: 'Analyzer Service',
    detail: 'Code graph',
    kind: 'service',
    column: 'backend'
  },
  {
    id: 'billing',
    label: 'Billing Service',
    detail: 'Usage limits',
    kind: 'service',
    column: 'backend'
  },
  {
    id: 'worker',
    label: 'Job Processor',
    detail: 'BullMQ worker',
    kind: 'worker',
    column: 'workers'
  },
  {
    id: 'review',
    label: 'Review Worker',
    detail: 'PR diff agent',
    kind: 'worker',
    column: 'workers'
  },
  {
    id: 'postgres',
    label: 'PostgreSQL',
    detail: 'pgvector',
    kind: 'data',
    column: 'data'
  },
  {
    id: 'redis',
    label: 'Redis',
    detail: 'Queue cache',
    kind: 'data',
    column: 'data'
  },
  {
    id: 'github',
    label: 'GitHub API',
    detail: 'Repository data',
    kind: 'external',
    column: 'data'
  }
]

export const sourceReferences: SourceReference[] = [
  {
    file: 'apps/api/src/main.ts',
    type: 'TS',
    service: 'API Gateway',
    description: 'HTTP entrypoint and request tracing',
    loc: 312,
    updated: '2h ago'
  },
  {
    file: 'packages/analyzer/src/graph.ts',
    type: 'TS',
    service: 'Analyzer Service',
    description: 'Module graph extraction and scoring',
    loc: 842,
    updated: '1d ago'
  },
  {
    file: 'packages/github/src/client.ts',
    type: 'TS',
    service: 'GitHub API',
    description: 'Rate-limited repository client',
    loc: 676,
    updated: '3d ago'
  },
  {
    file: 'apps/web/pages/repository.vue',
    type: 'VUE',
    service: 'Web',
    description: 'Repository dashboard workspace',
    loc: 128,
    updated: '2h ago'
  },
  {
    file: 'apps/worker/src/jobs/analyze.ts',
    type: 'TS',
    service: 'Job Processor',
    description: 'Chunking, embeddings, AI summary jobs',
    loc: 284,
    updated: '5h ago'
  },
  {
    file: 'packages/ai/src/prompts/review.ts',
    type: 'TS',
    service: 'Review Worker',
    description: 'PR review prompt and output schema',
    loc: 221,
    updated: '4h ago'
  }
]

export const pullRequests: PullRequest[] = [
  {
    id: '#512',
    title: 'Refactor billing service charge flow',
    changedFiles: 12,
    risk: 'High',
    checks: '2 / 4',
    url: 'github.com/acme/codeatlas/pull/512',
    affectedModules: ['API', 'Database', 'Auth and Security']
  },
  {
    id: '#511',
    title: 'Add caching to profile endpoint',
    changedFiles: 6,
    risk: 'Medium',
    checks: '3 / 4',
    url: 'github.com/acme/codeatlas/pull/511',
    affectedModules: ['API', 'Build and CI']
  },
  {
    id: '#509',
    title: 'Upgrade Fastify and dependencies',
    changedFiles: 4,
    risk: 'Low',
    checks: '4 / 4',
    url: 'github.com/acme/codeatlas/pull/509',
    affectedModules: ['Build and CI']
  },
  {
    id: '#508',
    title: 'Improve error handling in gateway',
    changedFiles: 3,
    risk: 'Low',
    checks: '3 / 4',
    url: 'github.com/acme/codeatlas/pull/508',
    affectedModules: ['API']
  },
  {
    id: '#507',
    title: 'Add unit tests for auth service',
    changedFiles: 8,
    risk: 'Medium',
    checks: '1 / 4',
    url: 'github.com/acme/codeatlas/pull/507',
    affectedModules: ['Tests', 'Auth and Security']
  }
]

export const pullRequestReview: PullRequestReview = {
  id: '#512',
  repositoryFullName: 'acme/codeatlas',
  title: 'Refactor billing service charge flow',
  url: 'github.com/acme/codeatlas/pull/512',
  author: 'sarah-dev',
  state: 'open',
  risk: 'High',
  changedFiles: 12,
  additions: 428,
  deletions: 173,
  summary: 'Refactor billing service charge flow changes API, Database, and Auth and Security in acme/codeatlas. CodeAtlas rates this PR as High risk based on 12 files, +428/-173.',
  affectedModules: [
    {
      name: 'API',
      files: 4,
      risk: 'Medium',
      reason: '4 files and 188 changed lines; largest change is apps/api/server/routes/billing.ts.'
    },
    {
      name: 'Database',
      files: 2,
      risk: 'High',
      reason: '2 files and 162 changed lines; largest change is prisma/migrations/202606290912_billing.sql.'
    },
    {
      name: 'Auth and Security',
      files: 1,
      risk: 'High',
      reason: '1 file and 42 changed lines; largest change is packages/auth/src/scopes.ts.'
    }
  ],
  missingTests: [
    'API-facing changes do not include matching API or route tests.',
    'Database or schema changes need migration and rollback coverage.'
  ],
  securityConcerns: [
    'PR text references auth, token, secret, permission, or session behavior; review access-control paths carefully.'
  ],
  breakingChanges: [
    'Database schema or migration files changed; confirm backward compatibility and rollback path.',
    'API route or controller files changed; confirm response contract compatibility.'
  ],
  suggestedComments: [
    {
      file: 'apps/api/server/routes/billing.ts',
      severity: 'Medium',
      message: 'Please add or point to tests covering this production behavior.',
      rationale: 'API-facing changes do not include matching API or route tests.'
    },
    {
      file: 'prisma/migrations/202606290912_billing.sql',
      severity: 'Medium',
      message: 'Please confirm compatibility, rollout, and rollback expectations.',
      rationale: 'Database schema or migration files changed; confirm backward compatibility and rollback path.'
    },
    {
      file: 'packages/auth/src/scopes.ts',
      severity: 'High',
      message: 'Please add an explicit security note or test coverage for this change path.',
      rationale: 'PR text references auth, token, secret, permission, or session behavior; review access-control paths carefully.'
    }
  ],
  checklist: [
    'Run repository typecheck and build before merge.',
    'Verify the changed user flow locally or in preview.',
    'Add targeted tests or document why existing coverage is sufficient.',
    'Confirm secrets, permissions, and output handling are safe.',
    'Document rollout, rollback, and compatibility impact.',
    'Require senior review before merge.'
  ],
  analyzedAt: '2026-06-29T12:00:00.000Z'
}

export const metrics: Metric[] = [
  {
    label: 'Latency p95',
    value: '312 ms',
    delta: '18%',
    trend: 'down',
    tone: 'good',
    points: [12, 19, 15, 26, 14, 13, 12, 18, 17, 11]
  },
  {
    label: 'Error rate',
    value: '0.58%',
    delta: '8%',
    trend: 'down',
    tone: 'good',
    points: [18, 12, 16, 13, 19, 11, 17, 15, 10, 12]
  },
  {
    label: 'Requests',
    value: '1.23M',
    delta: '12%',
    trend: 'up',
    tone: 'warn',
    points: [11, 14, 13, 16, 15, 12, 18, 10, 15, 13]
  },
  {
    label: 'AI analysis cost',
    value: '$24.18',
    delta: '6%',
    trend: 'down',
    tone: 'good',
    points: [10, 13, 12, 18, 14, 16, 12, 11, 9, 8]
  },
  {
    label: 'Tokens used',
    value: '2.31M',
    delta: '9%',
    trend: 'down',
    tone: 'good',
    points: [9, 13, 11, 12, 15, 14, 16, 10, 8, 11]
  },
  {
    label: 'Analysis jobs',
    value: '24',
    delta: '2',
    trend: 'up',
    tone: 'warn',
    points: [3, 8, 5, 9, 4, 6, 10, 4, 8, 7]
  }
]

export const summaryItems: SummaryItem[] = [
  {
    label: 'Purpose',
    text: 'SaaS platform for repository intelligence, onboarding, and review automation.',
    tone: 'neutral'
  },
  {
    label: 'Architecture',
    text: 'Layered TypeScript monorepo with async workers and shared packages.',
    tone: 'neutral'
  },
  {
    label: 'Strengths',
    text: 'Clear package boundaries, typed API clients, and structured analysis jobs.',
    tone: 'good'
  },
  {
    label: 'Risks',
    text: 'Billing flow is tightly coupled to usage limits, with limited failure-path tests.',
    tone: 'risk'
  },
  {
    label: 'Opportunities',
    text: 'Add contract tests, split review prompts, and expand observability around workers.',
    tone: 'opportunity'
  }
]

export const riskSignals = [
  'Missing idempotency guard in billing webhook',
  'Repository token scopes should be narrowed before private repo support',
  'PR review output needs schema validation before posting comments'
]
