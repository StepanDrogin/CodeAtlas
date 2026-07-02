<script setup lang="ts">
import {
  architectureNodes as demoArchitectureNodes,
  metrics,
  navItems,
  pullRequestReview as demoPullRequestReview,
  pullRequests as demoPullRequests,
  riskSignals as demoRiskSignals,
  sourceReferences as demoSourceReferences,
  summaryItems as demoSummaryItems
} from '~/data/demo'
import type {
  AiSessionItem,
  AnalysisStep,
  HealthSegment,
  InsightItem,
  NavSection,
  PullRequest,
  PullRequestReview,
  RecentAnalysis,
  RepositoryAnalysis,
  SourceReference,
  WorkspaceSetupStep
} from '~/types/codeatlas'

interface AiQuestionResponse {
  answer: string
  references?: SourceReference[]
  confidence?: number
}

interface WorkspaceActivity {
  label: string
  detail: string
  tone: 'info' | 'success' | 'warning' | 'danger'
}

interface ActivityLogItem extends WorkspaceActivity {
  id: number
  timestamp: string
}

interface StoredWorkspace {
  version: 1
  repository: string
  repoUrl: string
  prUrl: string
  activeSection: NavSection
  lastAnalyzedAt: string
  answer: string
  lastQuestion: string
  lastAiConfidence: number
  lastSavedAt: string
  lastReportExportedAt: string
  aiSessionHistory: AiSessionItem[]
  analysis: RepositoryAnalysis | null
  prReview: PullRequestReview | null
  recentAnalyses: RecentAnalysis[]
  activityLog: ActivityLogItem[]
  settings: Record<WorkspaceSettingKey, boolean>
}

const CLIENT_REQUEST_TIMEOUT_MS = 25000
const CANONICAL_URL = 'https://code-atlas-web-kappa.vercel.app/'
const RECENT_ANALYSES_STORAGE_KEY = 'codeatlas:recent-analyses'
const WORKSPACE_STORAGE_KEY = 'codeatlas:active-workspace'
const WORKSPACE_ARCHIVE_STORAGE_KEY = 'codeatlas:workspace-archive'
const ANALYSIS_TIMELINE_BASE = [
  {
    id: 'connect',
    label: 'Connect repository',
    detail: 'Validate the GitHub URL and prepare repository metadata.'
  },
  {
    id: 'index',
    label: 'Index files',
    detail: 'Read source paths, manifests, README, and pull request metadata.'
  },
  {
    id: 'architecture',
    label: 'Map architecture',
    detail: 'Group modules into entrypoints, services, workers, and data layers.'
  },
  {
    id: 'risk',
    label: 'Score risk',
    detail: 'Detect tests, CI, secrets, lifecycle scripts, and broad PR changes.'
  },
  {
    id: 'ai',
    label: 'Prepare AI context',
    detail: 'Build grounded source references for Gemini and local fallback answers.'
  }
] as const

const config = useRuntimeConfig()
const activeSection = ref<NavSection>('repository')
const repoUrl = ref('github.com/nuxt/nuxt')
const prUrl = ref('github.com/nuxt/nuxt/pull/32537')
const question = ref('')
const isAnalyzing = ref(false)
const isReviewingPr = ref(false)
const isAsking = ref(false)
const analysisError = ref('')
const prReviewError = ref('')
const aiQuestionError = ref('')
const lastAnalyzedAt = ref('Demo data - 1,842 files - 612k LOC')
const analysis = ref<RepositoryAnalysis | null>(null)
const prReview = ref<PullRequestReview | null>(null)
const recentAction = ref<WorkspaceActivity | null>(null)
const recentActionTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const activityLog = ref<ActivityLogItem[]>([])
const recentAnalyses = ref<RecentAnalysis[]>([])
const savedWorkspaces = ref<StoredWorkspace[]>([])
const aiSessionHistory = ref<AiSessionItem[]>([])
const lastQuestion = ref('')
const lastMatchedReferences = ref<SourceReference[]>([])
const lastAiConfidence = ref(82)
const lastWorkspaceSavedAt = ref('Not saved yet')
const lastReportExportedAt = ref('Not exported yet')
const analysisProgressStep = ref(ANALYSIS_TIMELINE_BASE.length - 1)
let activityLogId = 0
let analysisProgressTimer: ReturnType<typeof setInterval> | null = null
const answer = ref(
  'This repository is a TypeScript-first SaaS monorepo with a Nuxt dashboard, Fastify API boundary, background workers, and shared packages for GitHub, AI prompts, and repository analysis.'
)

const architectureNodes = computed(() => analysis.value?.architectureNodes ?? demoArchitectureNodes)
const sourceReferences = computed(() => analysis.value?.sourceReferences ?? demoSourceReferences)
const pullRequests = computed(() => analysis.value?.pullRequests ?? demoPullRequests)
const summaryItems = computed(() => analysis.value?.summaryItems ?? demoSummaryItems)
const riskSignals = computed(() => analysis.value?.riskSignals ?? demoRiskSignals)
const activePullRequestReview = computed(() => prReview.value ?? demoPullRequestReview)
const aiContextReferences = computed(() => {
  if (lastMatchedReferences.value.length) {
    return lastMatchedReferences.value
  }

  if (lastQuestion.value) {
    return findRelevantReferences(lastQuestion.value, sourceReferences.value)
  }

  return sourceReferences.value.slice(0, 3)
})
const aiConfidence = computed(() => {
  if (lastQuestion.value) {
    return lastAiConfidence.value
  }

  const referenceScore = Math.min(aiContextReferences.value.length * 18, 54)
  const riskPenalty = Math.min(riskSignals.value.length * 4, 18)
  const liveBonus = analysis.value ? 18 : 8

  return clampScore(referenceScore + liveBonus + 30 - riskPenalty)
})
const isDemoMode = computed(() => String(config.public.demoMode) === 'true')
const currentSection = computed(() => navItems.find((item) => item.id === activeSection.value) ?? {
  id: 'repository' as const,
  label: 'Repository',
  icon: 'repository'
})
const repositoryName = computed(() => analysis.value?.repository.fullName ?? normalizeRepositoryFullName(repoUrl.value) ?? 'nuxt/nuxt')
const repositoryDescription = computed(
  () => analysis.value?.repository.description || 'Repository intelligence workspace for architecture, references, PR review, and operational signals.'
)
const sectionMeta = computed(() => {
  switch (activeSection.value) {
    case 'architecture':
      return `${architectureNodes.value.length} nodes across the code graph`
    case 'ask':
      return isDemoMode.value ? 'Demo answer mode' : 'Gemini server route'
    case 'pr-review':
      return `${pullRequests.value.length} open pull requests`
    case 'observability':
      return `${metrics.length} live-style metrics`
    case 'bookmarks':
      return `${bookmarkedReferences.value.length} saved references`
    case 'reports':
      return `${reportRows.value.length} generated reports`
    case 'integrations':
      return `${integrationRows.value.length} integration endpoints`
    case 'settings':
      return 'Workspace preferences'
    default:
      return repositoryName.value
  }
})
const repositoryStats = computed(() => {
  const repository = analysis.value?.repository

  return [
    {
      label: 'Repository',
      value: repositoryName.value,
      detail: repositoryDescription.value
    },
    {
      label: 'Language',
      value: repository?.language ?? 'TypeScript',
      detail: `Default branch ${repository?.defaultBranch ?? 'main'}`
    },
    {
      label: 'Files',
      value: (repository?.fileCount ?? 1842).toLocaleString('en-US'),
      detail: `${formatLoc(repository?.estimatedLoc ?? 612000)} LOC`
    },
    {
      label: 'Community',
      value: `${(repository?.stars ?? 12400).toLocaleString('en-US')} stars`,
      detail: `${(repository?.forks ?? 920).toLocaleString('en-US')} forks`
    }
  ]
})
const healthSegments = computed<HealthSegment[]>(() => {
  const highRiskPullRequests = pullRequests.value.filter((pullRequest) => pullRequest.risk === 'High').length
  const mediumRiskPullRequests = pullRequests.value.filter((pullRequest) => pullRequest.risk === 'Medium').length
  const securitySignals = riskSignals.value.filter((signal) => /secret|token|auth|permission|scope|credential/i.test(signal)).length
  const testSignals = riskSignals.value.filter((signal) => /test|coverage|ci|check/i.test(signal)).length
  const architectureScore = clampScore(78 + architectureNodes.value.length * 2 - riskSignals.value.length * 4)
  const maintainabilityScore = clampScore(88 - highRiskPullRequests * 8 - mediumRiskPullRequests * 3 + Math.min(sourceReferences.value.length, 8))
  const securityScore = clampScore(92 - securitySignals * 12 - highRiskPullRequests * 4)
  const testabilityScore = clampScore(82 - testSignals * 10 - highRiskPullRequests * 4 + (riskSignals.value.length ? 0 : 6))
  const operationsScore = clampScore(86 - (analysis.value?.repository.truncated ? 10 : 0) + (isDemoMode.value ? 0 : 4))

  return [
    {
      label: 'Architecture',
      score: architectureScore,
      value: `${architectureNodes.value.length} nodes`,
      detail: 'Layer coverage, service boundaries, and graph readability.',
      tone: scoreTone(architectureScore)
    },
    {
      label: 'Maintainability',
      score: maintainabilityScore,
      value: `${sourceReferences.value.length} refs`,
      detail: 'Important source files, PR blast radius, and module clarity.',
      tone: scoreTone(maintainabilityScore)
    },
    {
      label: 'Security',
      score: securityScore,
      value: securitySignals ? `${securitySignals} signals` : 'Clear',
      detail: 'Secret, token, permission, and auth-sensitive findings.',
      tone: scoreTone(securityScore)
    },
    {
      label: 'Testability',
      score: testabilityScore,
      value: testSignals ? 'Watch' : 'Stable',
      detail: 'Signals around tests, CI checks, and review coverage.',
      tone: scoreTone(testabilityScore)
    },
    {
      label: 'Operations',
      score: operationsScore,
      value: isDemoMode.value ? 'Demo' : 'Live',
      detail: 'Runtime mode, truncation state, and deployment readiness.',
      tone: scoreTone(operationsScore)
    }
  ]
})
const repositoryHealthScore = computed(() => {
  const total = healthSegments.value.reduce((sum, segment) => sum + segment.score, 0)

  return Math.round(total / Math.max(healthSegments.value.length, 1))
})
const repositoryHealthLabel = computed(() => {
  if (repositoryHealthScore.value >= 90) {
    return 'Excellent'
  }

  if (repositoryHealthScore.value >= 80) {
    return 'Healthy'
  }

  if (repositoryHealthScore.value >= 68) {
    return 'Watch'
  }

  return 'Risky'
})
const analysisTimelineSteps = computed<AnalysisStep[]>(() => {
  const failedStep = Math.max(0, Math.min(analysisProgressStep.value, ANALYSIS_TIMELINE_BASE.length - 1))

  return ANALYSIS_TIMELINE_BASE.map((step, index) => {
    let status: AnalysisStep['status'] = 'complete'

    if (analysisError.value && index === failedStep) {
      status = 'failed'
    } else if (isAnalyzing.value) {
      status = index < analysisProgressStep.value ? 'complete' : index === analysisProgressStep.value ? 'active' : 'pending'
    } else if (analysisError.value) {
      status = index < failedStep ? 'complete' : 'pending'
    }

    return {
      ...step,
      status
    }
  })
})
const insightFeed = computed<InsightItem[]>(() => {
  const risk = riskSignals.value[0]
  const highRiskPullRequest = pullRequests.value.find((pullRequest) => pullRequest.risk === 'High')
  const opportunity = summaryItems.value.find((item) => item.tone === 'opportunity')
  const strength = summaryItems.value.find((item) => item.tone === 'good')

  return [
    {
      id: 'health',
      label: `${repositoryHealthLabel.value} repository health`,
      detail: `Composite score ${repositoryHealthScore.value}/100 across architecture, maintainability, security, tests, and operations.`,
      tone: repositoryHealthScore.value >= 80 ? 'good' : repositoryHealthScore.value >= 68 ? 'warning' : 'risk',
      section: 'reports',
      action: 'Open reports'
    },
    {
      id: 'risk',
      label: risk ? 'Top risk signal' : 'Risk scan clean',
      detail: risk ?? 'No blocking repository hygiene risks were detected in the current analysis.',
      tone: risk ? 'risk' : 'good',
      section: risk ? 'pr-review' : 'architecture',
      action: risk ? 'Review risk' : 'Inspect architecture'
    },
    {
      id: 'pr',
      label: highRiskPullRequest ? `Escalated PR ${highRiskPullRequest.id}` : 'Pull requests ready',
      detail: highRiskPullRequest
        ? `${highRiskPullRequest.title} touches ${highRiskPullRequest.changedFiles} files and should be reviewed before merge.`
        : `${pullRequests.value.length} pull requests are available with no high-risk item first in queue.`,
      tone: highRiskPullRequest ? 'warning' : 'info',
      section: 'pr-review',
      action: 'Open PR review'
    },
    {
      id: 'opportunity',
      label: opportunity?.label ?? 'Next opportunity',
      detail: opportunity?.text ?? 'Ask CodeAtlas for a targeted refactor or test plan.',
      tone: 'info',
      section: 'ask',
      action: 'Ask CodeAtlas'
    },
    {
      id: 'strength',
      label: strength?.label ?? 'Strength detected',
      detail: strength?.text ?? 'The repository has enough source references for a grounded first pass.',
      tone: 'good'
    }
  ]
})
const bookmarkedReferences = computed(() =>
  sourceReferences.value.slice(0, 4).map((reference, index) => ({
    ...reference,
    priority: ['Critical path', 'Architecture', 'API boundary', 'Review context'][index] ?? 'Saved reference'
  }))
)
const reportRows = computed(() => [
  {
    name: 'Architecture brief',
    status: 'Ready',
    scope: `${architectureNodes.value.length} nodes`,
    updated: lastAnalyzedAt.value
  },
  {
    name: 'Risk register',
    status: riskSignals.value.length ? 'Needs review' : 'Ready',
    scope: `${riskSignals.value.length} signals`,
    updated: activePullRequestReview.value.analyzedAt
  },
  {
    name: 'PR review pack',
    status: activePullRequestReview.value.risk === 'High' ? 'Escalated' : 'Ready',
    scope: `${activePullRequestReview.value.changedFiles} files changed`,
    updated: activePullRequestReview.value.id
  }
])
const workspaceSetupSteps = computed<WorkspaceSetupStep[]>(() => [
  {
    id: 'connect',
    label: 'Connect repository',
    detail: analysis.value ? `${repositoryName.value} is indexed with live source metadata.` : 'Paste a GitHub repository URL or keep the demo workspace.',
    status: analysis.value || repoUrl.value ? 'done' : 'active',
    action: 'Edit repository'
  },
  {
    id: 'analyze',
    label: 'Run analysis',
    detail: analysis.value ? `${sourceReferences.value.length} source references and ${architectureNodes.value.length} nodes are ready.` : 'Build architecture, references, risk signals, and PR context.',
    status: analysis.value ? 'done' : 'active',
    action: analysis.value ? 'Re-run analysis' : 'Analyze now'
  },
  {
    id: 'ask',
    label: 'Ask with sources',
    detail: aiSessionHistory.value.length ? `${aiSessionHistory.value.length} AI session questions are saved.` : 'Ask Gemini or local fallback a repository question with cited files.',
    status: aiSessionHistory.value.length ? 'done' : analysis.value ? 'active' : 'pending',
    action: 'Open AI workspace'
  },
  {
    id: 'export',
    label: 'Export report',
    detail: lastReportExportedAt.value === 'Not exported yet' ? 'Create a Markdown or JSON report for portfolio review.' : `Last exported ${lastReportExportedAt.value}.`,
    status: lastReportExportedAt.value === 'Not exported yet' ? 'pending' : 'done',
    action: 'Export package'
  }
])
const aiFollowUpPrompts = computed(() => {
  const primaryReference = aiContextReferences.value[0] ?? sourceReferences.value[0]
  const riskyReference = sourceReferences.value.find((reference) => /auth|token|secret|payment|security|api/i.test(`${reference.file} ${reference.description}`)) ?? primaryReference
  const primaryNode = architectureNodes.value[0]
  const riskPrompt = riskSignals.value[0]
    ? `Turn this risk into a mitigation plan: ${riskSignals.value[0]}`
    : `What hidden risks should I check before changing ${primaryReference?.service ?? repositoryName.value}?`

  return [
    primaryReference ? `Which tests should protect ${primaryReference.file}?` : `What should I inspect first in ${repositoryName.value}?`,
    primaryNode ? `Explain ${primaryNode.label} dependencies and failure modes.` : `Map the main architecture risks in ${repositoryName.value}.`,
    riskPrompt,
    riskyReference ? `What can break if I change ${riskyReference.file}?` : `Prepare a refactor plan for the highest-risk module.`
  ].filter((prompt, index, prompts) => prompts.indexOf(prompt) === index).slice(0, 4)
})
const reportMarkdown = computed(() => {
  const repository = analysis.value?.repository
  const summary = summaryItems.value.map((item) => `- **${item.label}:** ${item.text}`).join('\n')
  const risks = riskSignals.value.length ? riskSignals.value.map((risk) => `- ${risk}`).join('\n') : '- No blocking risk signals detected.'
  const sources = sourceReferences.value.slice(0, 10).map((reference) => `- \`${reference.file}\` (${reference.service}): ${reference.description}`).join('\n')
  const nodes = architectureNodes.value.map((node) => `- ${node.label} (${node.kind}): ${node.detail}`).join('\n')
  const sessions = aiSessionHistory.value.length
    ? aiSessionHistory.value.map((item) => `- **${item.question}** (${item.mode}, ${item.confidence}%): ${item.references.slice(0, 3).map((reference) => `\`${reference.file}\``).join(', ') || 'No source references'}`).join('\n')
    : '- No AI session questions saved yet.'
  const pr = activePullRequestReview.value

  return `# CodeAtlas Report: ${repositoryName.value}

Generated: ${new Date().toISOString()}
Mode: ${isDemoMode.value ? 'Demo fallback' : 'Live API'}
Health: ${repositoryHealthScore.value}/100 (${repositoryHealthLabel.value})

## Repository

- URL: ${repository?.url ?? `https://github.com/${repositoryName.value}`}
- Language: ${repository?.language ?? 'TypeScript'}
- Files: ${(repository?.fileCount ?? 1842).toLocaleString('en-US')}
- Estimated LOC: ${formatLoc(repository?.estimatedLoc ?? 612000)}
- Stars: ${(repository?.stars ?? 12400).toLocaleString('en-US')}

## AI Summary

${answer.value}

## AI Session Log

${sessions}

## Summary Items

${summary}

## Architecture Nodes

${nodes}

## Source References

${sources}

## Risk Signals

${risks}

## Pull Request Review

- PR: ${pr.id} ${pr.title}
- Risk: ${pr.risk}
- Changed files: ${pr.changedFiles}
- Summary: ${pr.summary}

## Next Steps

- Ask CodeAtlas about the highest-risk module.
- Review source references before editing architecture-critical files.
- Export this report after every major analysis run.
`
})
const integrationRows = computed(() => [
  {
    name: 'GitHub',
    status: analysis.value ? 'Synced' : 'Ready',
    detail: `${sourceReferences.value.length} references, ${pullRequests.value.length} pull requests`
  },
  {
    name: 'Gemini',
    status: isDemoMode.value ? 'Demo fallback' : 'Server route',
    detail: 'Repository summaries, Q&A, and PR review fallback'
  },
  {
    name: 'Vercel',
    status: 'Production',
    detail: 'Server-capable portfolio deployment with live API routes'
  },
  {
    name: 'Local API',
    status: 'Development',
    detail: 'Live repository analysis and server-side AI calls'
  }
])

type WorkspaceSettingKey = 'autoReview' | 'strictSignals' | 'privateRepoIndexing'

const workspaceSettings = reactive<Record<WorkspaceSettingKey, boolean>>({
  autoReview: true,
  strictSignals: true,
  privateRepoIndexing: false
})

const settingsToggles = computed<Array<{ key: WorkspaceSettingKey; label: string; detail: string; enabled: boolean }>>(() => [
  {
    key: 'autoReview',
    label: 'Auto PR review',
    detail: 'Queue review notes when a pull request URL is analyzed.',
    enabled: workspaceSettings.autoReview
  },
  {
    key: 'strictSignals',
    label: 'Strict risk signals',
    detail: 'Keep security, tests, and breaking-change checks prominent.',
    enabled: workspaceSettings.strictSignals
  },
  {
    key: 'privateRepoIndexing',
    label: 'Private repo indexing',
    detail: 'Reserved for narrowed GitHub token scopes.',
    enabled: workspaceSettings.privateRepoIndexing
  }
])
const settingsRows = computed(() => [
  { label: 'Mode', value: isDemoMode.value ? 'Static demo' : 'Live server' },
  { label: 'Repository', value: repositoryName.value },
  { label: 'PR source', value: activePullRequestReview.value.repositoryFullName },
  { label: 'AI provider', value: isDemoMode.value ? 'Demo fallback' : 'Google Gemini' },
  { label: 'AI sessions', value: aiSessionHistory.value.length.toString() },
  { label: 'Saved workspaces', value: savedWorkspaces.value.length.toString() },
  { label: 'Last export', value: lastReportExportedAt.value }
])

const isWorkspaceBusy = computed(() => isAnalyzing.value || isReviewingPr.value || isAsking.value)
const workspaceActivity = computed<WorkspaceActivity>(() => {
  if (isAnalyzing.value) {
    return {
      label: 'Analyzing repository',
      detail: 'Indexing files, architecture, risks, and pull requests.',
      tone: 'warning'
    }
  }

  if (isReviewingPr.value) {
    return {
      label: 'Reviewing pull request',
      detail: 'Collecting changed files and review signals.',
      tone: 'warning'
    }
  }

  if (isAsking.value) {
    return {
      label: 'Asking Gemini',
      detail: 'Preparing an answer from current source references.',
      tone: 'info'
    }
  }

  return recentAction.value ?? {
    label: 'Workspace ready',
    detail: 'Controls are available.',
    tone: 'success'
  }
})
const activityToneClass = computed(() => {
  const tone = workspaceActivity.value.tone

  if (tone === 'danger') {
    return 'bg-red-50 text-atlas-danger ring-red-100'
  }

  if (tone === 'warning') {
    return 'bg-amber-50 text-amber-700 ring-amber-100'
  }

  if (tone === 'info') {
    return 'bg-blue-50 text-atlas-info ring-blue-100'
  }

  return 'bg-emerald-50 text-atlas-success ring-emerald-100'
})
const pageTitle = computed(() => {
  if (activeSection.value === 'repository') {
    return `CodeAtlas - AI repository intelligence for ${repositoryName.value}`
  }

  return `CodeAtlas ${currentSection.value.label} - ${repositoryName.value}`
})
const pageDescription = computed(() => {
  const sectionDescription: Record<NavSection, string> = {
    repository: 'Analyze GitHub repositories, source references, architecture, risks, and pull requests in a focused AI workspace.',
    architecture: 'Map repository layers, service boundaries, workers, data flows, and source references with CodeAtlas.',
    ask: 'Ask Gemini-backed CodeAtlas questions about the current repository and get answers grounded in source references.',
    'pr-review': 'Review pull requests with changed-file context, risk signals, missing tests, and suggested reviewer comments.',
    observability: 'Track repository analysis metrics, latency, requests, error rate, token use, and operational health.',
    bookmarks: 'Save important source references and pull request watchlist items for follow-up repository work.',
    reports: 'Generate architecture briefs, risk registers, and pull request review packs from repository analysis.',
    integrations: 'Connect CodeAtlas with GitHub, Gemini, local APIs, and deployment workflows.',
    settings: 'Configure CodeAtlas workspace behavior, risk signals, AI mode, and repository context.'
  }

  return sectionDescription[activeSection.value]
})

useHead(() => ({
  htmlAttrs: {
    lang: 'en'
  },
  title: pageTitle.value,
  meta: [
    { name: 'description', content: pageDescription.value },
    { name: 'application-name', content: 'CodeAtlas' },
    { name: 'author', content: 'Stepan Drogin' },
    { name: 'robots', content: 'index, follow, max-image-preview:large' },
    { name: 'theme-color', content: '#007f78' },
    { name: 'color-scheme', content: 'light' },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'CodeAtlas' },
    { property: 'og:title', content: pageTitle.value },
    { property: 'og:description', content: pageDescription.value },
    { property: 'og:url', content: CANONICAL_URL },
    { property: 'og:image', content: `${CANONICAL_URL}og-image.svg` },
    { property: 'og:image:type', content: 'image/svg+xml' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: pageTitle.value },
    { name: 'twitter:description', content: pageDescription.value },
    { name: 'twitter:image', content: `${CANONICAL_URL}og-image.svg` }
  ],
  link: [
    { rel: 'canonical', href: CANONICAL_URL },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.svg' },
    { rel: 'manifest', href: '/site.webmanifest' }
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'CodeAtlas',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        url: CANONICAL_URL,
        description: pageDescription.value,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        },
        creator: {
          '@type': 'Person',
          name: 'Stepan Drogin'
        }
      })
    }
  ]
}))

watchEffect(() => {
  if (import.meta.client) {
    document.title = pageTitle.value
  }
})

const notifyWorkspace = (label: string, detail: string, tone: WorkspaceActivity['tone'] = 'info') => {
  recentAction.value = { label, detail, tone }
  activityLog.value = [
    {
      id: ++activityLogId,
      label,
      detail,
      tone,
      timestamp: formatActivityTime(new Date())
    },
    ...activityLog.value
  ].slice(0, 8)

  if (recentActionTimeout.value) {
    clearTimeout(recentActionTimeout.value)
  }

  recentActionTimeout.value = setTimeout(() => {
    recentAction.value = null
  }, 2600)
}

const changeSection = (section: NavSection) => {
  activeSection.value = section
  const target = navItems.find((item) => item.id === section)

  notifyWorkspace('Section switched', target?.label ?? 'Workspace view updated', 'info')
  persistWorkspaceState()
}

const handleUtilityAction = (label: string, detail: string) => {
  notifyWorkspace(label, detail, 'info')
}

const focusRepositoryInput = async () => {
  await nextTick()

  if (!import.meta.client) {
    return
  }

  const input = document.getElementById('repo-url') as HTMLInputElement | null
  input?.focus()
  input?.select()
}

const startNewAnalysis = async () => {
  activeSection.value = 'repository'
  analysisError.value = ''
  notifyWorkspace('New analysis ready', 'Repository field selected. Paste a GitHub URL and run analysis.', 'info')
  persistWorkspaceState()
  await focusRepositoryInput()
}

const selectRecentAnalysis = async (repository: string) => {
  if (restoreWorkspaceByRepository(repository)) {
    await focusRepositoryInput()

    return
  }

  repoUrl.value = `github.com/${repository}`
  activeSection.value = 'repository'
  notifyWorkspace('Recent analysis selected', `${repository} is ready to run again.`, 'info')
  await focusRepositoryInput()
}

const loadRecentAnalyses = () => {
  if (!import.meta.client) {
    return
  }

  try {
    const saved = window.localStorage.getItem(RECENT_ANALYSES_STORAGE_KEY)

    if (saved) {
      const parsed = JSON.parse(saved) as RecentAnalysis[]

      if (Array.isArray(parsed)) {
        recentAnalyses.value = parsed.filter(isRecentAnalysis).slice(0, 6)
      }
    }
  } catch {
    recentAnalyses.value = []
  }

  if (!recentAnalyses.value.length) {
    recentAnalyses.value = [buildRecentAnalysisEntry()]
  }
}

const persistRecentAnalyses = () => {
  if (!import.meta.client) {
    return
  }

  window.localStorage.setItem(RECENT_ANALYSES_STORAGE_KEY, JSON.stringify(recentAnalyses.value.slice(0, 6)))
}

const buildWorkspaceSnapshot = (): StoredWorkspace => ({
  version: 1,
  repository: repositoryName.value,
  repoUrl: repoUrl.value,
  prUrl: prUrl.value,
  activeSection: activeSection.value,
  lastAnalyzedAt: lastAnalyzedAt.value,
  answer: answer.value,
  lastQuestion: lastQuestion.value,
  lastAiConfidence: lastAiConfidence.value,
  lastSavedAt: formatRecentAnalysisTime(new Date()),
  lastReportExportedAt: lastReportExportedAt.value,
  aiSessionHistory: aiSessionHistory.value.slice(0, 10),
  analysis: analysis.value,
  prReview: prReview.value,
  recentAnalyses: recentAnalyses.value.slice(0, 6),
  activityLog: activityLog.value.slice(0, 8),
  settings: { ...workspaceSettings }
})

const applyWorkspaceSnapshot = (snapshot: StoredWorkspace) => {
  repoUrl.value = snapshot.repoUrl
  prUrl.value = snapshot.prUrl
  activeSection.value = snapshot.activeSection
  lastAnalyzedAt.value = snapshot.lastAnalyzedAt
  answer.value = snapshot.answer
  lastQuestion.value = snapshot.lastQuestion
  question.value = snapshot.lastQuestion
  lastAiConfidence.value = snapshot.lastAiConfidence || 82
  lastWorkspaceSavedAt.value = snapshot.lastSavedAt
  lastReportExportedAt.value = snapshot.lastReportExportedAt || 'Not exported yet'
  aiSessionHistory.value = snapshot.aiSessionHistory?.filter(isAiSessionItem).slice(0, 10) ?? []
  analysis.value = snapshot.analysis
  prReview.value = snapshot.prReview
  recentAnalyses.value = snapshot.recentAnalyses.filter(isRecentAnalysis).slice(0, 6)
  activityLog.value = snapshot.activityLog.slice(0, 8)
  Object.assign(workspaceSettings, snapshot.settings)
  lastMatchedReferences.value = snapshot.lastQuestion ? findRelevantReferences(snapshot.lastQuestion, sourceReferences.value) : []
}

const persistWorkspaceState = () => {
  if (!import.meta.client) {
    return
  }

  const snapshot = buildWorkspaceSnapshot()
  const archive = [
    snapshot,
    ...savedWorkspaces.value.filter((workspace) => workspace.repository !== snapshot.repository)
  ].slice(0, 6)

  savedWorkspaces.value = archive
  lastWorkspaceSavedAt.value = snapshot.lastSavedAt
  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot))
  window.localStorage.setItem(WORKSPACE_ARCHIVE_STORAGE_KEY, JSON.stringify(archive))
}

const loadWorkspaceState = () => {
  if (!import.meta.client) {
    return
  }

  try {
    const archived = window.localStorage.getItem(WORKSPACE_ARCHIVE_STORAGE_KEY)

    if (archived) {
      const parsed = JSON.parse(archived) as StoredWorkspace[]

      if (Array.isArray(parsed)) {
        savedWorkspaces.value = parsed.filter(isStoredWorkspace).slice(0, 6)
      }
    }

    const saved = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)

    if (saved) {
      const parsed = JSON.parse(saved) as StoredWorkspace

      if (isStoredWorkspace(parsed)) {
        applyWorkspaceSnapshot(parsed)
      }
    }
  } catch {
    savedWorkspaces.value = []
  }
}

const restoreWorkspaceByRepository = (repository: string) => {
  const snapshot = savedWorkspaces.value.find((workspace) => workspace.repository === repository)

  if (!snapshot) {
    return false
  }

  applyWorkspaceSnapshot(snapshot)
  notifyWorkspace('Workspace restored', `${repository} analysis state was loaded from this browser.`, 'success')

  return true
}

const recordRecentAnalysis = () => {
  const entry = buildRecentAnalysisEntry()
  recentAnalyses.value = [
    entry,
    ...recentAnalyses.value.filter((analysisItem) => analysisItem.repository !== entry.repository)
  ].slice(0, 6)
  persistRecentAnalyses()
  persistWorkspaceState()
}

const buildRecentAnalysisEntry = (): RecentAnalysis => {
  const repository = analysis.value?.repository

  return {
    id: `${repositoryName.value}-${Date.now()}`,
    repository: repositoryName.value,
    description: repositoryDescription.value,
    score: repositoryHealthScore.value,
    healthLabel: repositoryHealthLabel.value,
    analyzedAt: formatRecentAnalysisTime(new Date()),
    meta: `${(repository?.fileCount ?? 1842).toLocaleString('en-US')} files - ${formatLoc(repository?.estimatedLoc ?? 612000)} LOC`
  }
}

const startAnalysisProgress = () => {
  stopAnalysisProgress()
  analysisProgressStep.value = 0
  analysisProgressTimer = setInterval(() => {
    analysisProgressStep.value = Math.min(analysisProgressStep.value + 1, ANALYSIS_TIMELINE_BASE.length - 1)
  }, 850)
}

const stopAnalysisProgress = (completed = true) => {
  if (analysisProgressTimer) {
    clearInterval(analysisProgressTimer)
    analysisProgressTimer = null
  }

  if (completed) {
    analysisProgressStep.value = ANALYSIS_TIMELINE_BASE.length - 1
  }
}

const toggleWorkspaceSetting = (key: WorkspaceSettingKey) => {
  workspaceSettings[key] = !workspaceSettings[key]
  notifyWorkspace(
    workspaceSettings[key] ? 'Setting enabled' : 'Setting disabled',
    settingsToggles.value.find((setting) => setting.key === key)?.label ?? 'Workspace preference updated',
    'success'
  )
  persistWorkspaceState()
}

const openPullRequestReview = (pullRequest: PullRequest) => {
  if (pullRequest.url) {
    prUrl.value = pullRequest.url
  }

  changeSection('pr-review')
  notifyWorkspace('Pull request selected', `${pullRequest.id} is ready for review.`, 'info')
}

const handleWorkspaceSetupAction = async (id: string) => {
  if (id === 'connect') {
    await startNewAnalysis()

    return
  }

  if (id === 'analyze') {
    await analyzeRepository()

    return
  }

  if (id === 'ask') {
    changeSection('ask')

    if (!question.value.trim()) {
      question.value = `What should I inspect first in ${repositoryName.value}?`
    }

    await nextTick()
    document.getElementById('codeatlas-question')?.focus()

    return
  }

  if (id === 'export') {
    exportCurrentReport('markdown')
  }
}

const exportCurrentReport = (format: 'markdown' | 'json' = 'markdown') => {
  if (!import.meta.client) {
    return
  }

  const filenameBase = repositoryName.value.replace(/[^\w.-]+/g, '-').toLowerCase()
  const isJson = format === 'json'
  const content = isJson
    ? JSON.stringify(
        {
          repository: analysis.value?.repository ?? repositoryStats.value,
          health: {
            score: repositoryHealthScore.value,
            label: repositoryHealthLabel.value,
            segments: healthSegments.value
          },
          architectureNodes: architectureNodes.value,
          sourceReferences: sourceReferences.value,
          riskSignals: riskSignals.value,
          pullRequestReview: activePullRequestReview.value,
          answer: answer.value,
          lastQuestion: lastQuestion.value,
          aiSessionHistory: aiSessionHistory.value,
          generatedAt: new Date().toISOString()
        },
        null,
        2
      )
    : reportMarkdown.value
  const blob = new Blob([content], { type: isJson ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `${filenameBase}-codeatlas-report.${isJson ? 'json' : 'md'}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  lastReportExportedAt.value = formatRecentAnalysisTime(new Date())
  notifyWorkspace('Report exported', `${repositoryName.value} ${isJson ? 'JSON' : 'Markdown'} report downloaded.`, 'success')
  persistWorkspaceState()
}

const copyCurrentReport = async () => {
  try {
    await navigator.clipboard.writeText(reportMarkdown.value)
    lastReportExportedAt.value = formatRecentAnalysisTime(new Date())
    notifyWorkspace('Report copied', 'Markdown report is ready in clipboard.', 'success')
    persistWorkspaceState()
  } catch {
    notifyWorkspace('Copy failed', 'Browser clipboard access was not available.', 'warning')
  }
}

const clearWorkspace = () => {
  analysis.value = null
  prReview.value = null
  aiSessionHistory.value = []
  lastQuestion.value = ''
  lastMatchedReferences.value = []
  lastAiConfidence.value = 82
  answer.value =
    'This repository is a TypeScript-first SaaS monorepo with a Nuxt dashboard, Fastify API boundary, background workers, and shared packages for GitHub, AI prompts, and repository analysis.'
  lastAnalyzedAt.value = 'Demo data - 1,842 files - 612k LOC'
  lastReportExportedAt.value = 'Not exported yet'
  activeSection.value = 'repository'
  analysisError.value = ''
  prReviewError.value = ''
  aiQuestionError.value = ''

  if (import.meta.client) {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
  }

  notifyWorkspace('Workspace cleared', 'Local active analysis was reset. Saved archive remains available.', 'info')
}

const recordAiSessionItem = (item: Omit<AiSessionItem, 'id' | 'askedAt'>) => {
  const entry: AiSessionItem = {
    ...item,
    id: `${Date.now()}-${item.mode}`,
    askedAt: formatRecentAnalysisTime(new Date()),
    references: item.references.slice(0, 6)
  }

  aiSessionHistory.value = [
    entry,
    ...aiSessionHistory.value.filter((historyItem) => historyItem.question !== entry.question)
  ].slice(0, 10)
}

const selectAiSessionItem = (item: AiSessionItem) => {
  question.value = item.question
  lastQuestion.value = item.question
  answer.value = item.answer
  lastMatchedReferences.value = item.references
  lastAiConfidence.value = item.confidence
  changeSection('ask')
  notifyWorkspace('AI answer restored', `${item.references.length} source references loaded from session history.`, 'info')
  persistWorkspaceState()
}

const askSuggestedQuestion = async (prompt: string) => {
  question.value = prompt
  changeSection('ask')
  await nextTick()
  await askCodeAtlas()
}

const clearAiSessionHistory = () => {
  aiSessionHistory.value = []
  notifyWorkspace('AI session cleared', 'Question history was removed from this workspace.', 'info')
  persistWorkspaceState()
}

const askAboutArchitectureNode = async (node: { label: string; detail: string }) => {
  question.value = `Explain ${node.label}: responsibilities, source files, risks, and tests.`
  lastQuestion.value = question.value
  lastMatchedReferences.value = findRelevantReferences(`${node.label} ${node.detail}`, sourceReferences.value)
  lastAiConfidence.value = Math.max(58, Math.min(92, 62 + lastMatchedReferences.value.length * 8 - riskSignals.value.length * 2))
  changeSection('ask')
  notifyWorkspace('Node question prepared', `${node.label} is ready in the AI workspace.`, 'info')
  await nextTick()
  document.getElementById('codeatlas-question')?.focus()
}

const withClientTimeout = async <T>(request: (signal: AbortSignal) => Promise<T>) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS)

  try {
    return await request(controller.signal)
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('Request timed out. Try again in a moment.')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

const analyzeRepository = async () => {
  if (!repoUrl.value.trim() || isAnalyzing.value) {
    return
  }

  isAnalyzing.value = true
  analysisError.value = ''
  lastAnalyzedAt.value = 'Analysis started now'
  startAnalysisProgress()
  let succeeded = false
  const previousRepository = repositoryName.value

  try {
    const result = isDemoMode.value
      ? buildDemoRepositoryAnalysis(repoUrl.value)
      : await withClientTimeout((signal) =>
          $fetch<RepositoryAnalysis>('/api/repositories/analyze', {
            method: 'POST',
            signal,
            body: {
              repository: repoUrl.value
            }
          })
        )

    analysis.value = result
    repoUrl.value = `github.com/${result.repository.fullName}`
    prUrl.value = result.pullRequests[0]?.url ?? prUrl.value
    prReview.value = null
    if (result.repository.fullName !== previousRepository) {
      aiSessionHistory.value = []
      lastQuestion.value = ''
      lastMatchedReferences.value = []
      lastAiConfidence.value = 82
      aiQuestionError.value = ''
    }
    answer.value = result.answer
    lastAnalyzedAt.value = `Completed just now - ${result.repository.fileCount.toLocaleString('en-US')} files - ${formatLoc(result.repository.estimatedLoc)} LOC`
    recordRecentAnalysis()
    notifyWorkspace('Repository analysis complete', `${result.repository.fullName} is ready.`, 'success')
    persistWorkspaceState()
    succeeded = true
  } catch (error) {
    analysisError.value = getErrorMessage(error)
    lastAnalyzedAt.value = 'Analysis failed'
    notifyWorkspace('Repository analysis failed', analysisError.value, 'danger')
    persistWorkspaceState()
  } finally {
    isAnalyzing.value = false
    stopAnalysisProgress(succeeded)
  }
}

const reviewPullRequest = async () => {
  if (!prUrl.value.trim() || isReviewingPr.value) {
    return
  }

  isReviewingPr.value = true
  prReviewError.value = ''

  try {
    prReview.value = isDemoMode.value
      ? buildDemoPullRequestReview(prUrl.value)
      : await withClientTimeout((signal) =>
          $fetch<PullRequestReview>('/api/pull-requests/review', {
            method: 'POST',
            signal,
            body: {
              pullRequest: prUrl.value
            }
          })
        )

    notifyWorkspace('Pull request review complete', `${prReview.value.repositoryFullName} ${prReview.value.id} is ready.`, 'success')
    persistWorkspaceState()
  } catch (error) {
    prReviewError.value = getErrorMessage(error)
    notifyWorkspace('Pull request review failed', prReviewError.value, 'danger')
    persistWorkspaceState()
  } finally {
    isReviewingPr.value = false
  }
}

const buildDemoRepositoryAnalysis = (repository: string): RepositoryAnalysis => {
  const fullName = normalizeRepositoryFullName(repository) ?? 'acme/codeatlas'

  return {
    repository: {
      fullName,
      description: 'Static CodeAtlas demo repository.',
      defaultBranch: 'main',
      url: `https://github.com/${fullName}`,
      language: 'TypeScript',
      stars: 12400,
      forks: 920,
      fileCount: 1842,
      estimatedLoc: 612000,
      truncated: false
    },
    architectureNodes: demoArchitectureNodes,
    sourceReferences: demoSourceReferences,
    pullRequests: demoPullRequests,
    summaryItems: demoSummaryItems,
    riskSignals: demoRiskSignals,
    technologies: ['TypeScript', 'Nuxt', 'Vue', 'Node.js'],
    answer:
      'CodeAtlas is running in static demo mode. Deploy to a server-capable host such as Vercel to enable live GitHub API analysis and LLM calls.',
    analyzedAt: new Date().toISOString()
  }
}

const buildDemoPullRequestReview = (pullRequest: string): PullRequestReview => {
  const parsed = parsePullRequestUrl(pullRequest)

  return {
    ...demoPullRequestReview,
    id: parsed ? `#${parsed.number}` : demoPullRequestReview.id,
    repositoryFullName: parsed?.repositoryFullName ?? demoPullRequestReview.repositoryFullName,
    url: pullRequest.trim() || demoPullRequestReview.url,
    analyzedAt: new Date().toISOString()
  }
}

function normalizeRepositoryFullName(value: string) {
  const cleaned = value.trim().replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\/$/, '')
  const [owner, repo] = cleaned.split('/')

  if (!owner || !repo) {
    return null
  }

  return `${owner}/${repo}`
}

function parsePullRequestUrl(value: string) {
  const match = value.trim().match(/(?:github\.com\/)?([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/)

  if (!match) {
    return null
  }

  return {
    repositoryFullName: `${match[1]}/${match[2]}`,
    number: Number(match[3])
  }
}

const askCodeAtlas = async () => {
  const normalizedQuestion = question.value.trim()

  if (!normalizedQuestion || isAsking.value) {
    return
  }

  const matches = findRelevantReferences(normalizedQuestion, sourceReferences.value)
  const files = matches.map((reference) => reference.file).join(', ')
  const repoName = analysis.value?.repository.fullName ?? 'the demo repository'
  const fallbackAnswer = `For "${normalizedQuestion}", start in ${files}. CodeAtlas selected these files from ${repoName} because their path, service, or description best matched the question.`
  lastQuestion.value = normalizedQuestion
  lastMatchedReferences.value = matches

  if (isDemoMode.value) {
    answer.value = fallbackAnswer
    aiQuestionError.value = ''
    lastAiConfidence.value = Math.max(54, Math.min(94, 58 + matches.length * 9 - riskSignals.value.length * 3))
    recordAiSessionItem({
      question: normalizedQuestion,
      answer: answer.value,
      confidence: lastAiConfidence.value,
      references: lastMatchedReferences.value,
      mode: 'demo'
    })
    notifyWorkspace('Local answer ready', 'Demo-mode source references were matched.', 'success')
    persistWorkspaceState()

    return
  }

  isAsking.value = true
  aiQuestionError.value = ''
  answer.value = 'Asking Gemini with the current CodeAtlas source references...'

  try {
    const result = await withClientTimeout((signal) =>
      $fetch<AiQuestionResponse>('/api/ai/question', {
        method: 'POST',
        signal,
        body: {
          question: normalizedQuestion,
          repositoryFullName: repoName,
          references: sourceReferences.value,
          risks: riskSignals.value
        }
      })
    )

    answer.value = result.answer || fallbackAnswer
    lastMatchedReferences.value = Array.isArray(result.references) && result.references.length ? result.references : matches
    lastAiConfidence.value = typeof result.confidence === 'number' ? result.confidence : aiConfidence.value
    recordAiSessionItem({
      question: normalizedQuestion,
      answer: answer.value,
      confidence: lastAiConfidence.value,
      references: lastMatchedReferences.value,
      mode: 'gemini'
    })
    notifyWorkspace('Gemini answer ready', 'The answer is grounded in current source references.', 'success')
    persistWorkspaceState()
  } catch (error) {
    aiQuestionError.value = getErrorMessage(error)
    answer.value = fallbackAnswer
    lastAiConfidence.value = Math.max(54, Math.min(88, 54 + matches.length * 8 - riskSignals.value.length * 3))
    recordAiSessionItem({
      question: normalizedQuestion,
      answer: answer.value,
      confidence: lastAiConfidence.value,
      references: lastMatchedReferences.value,
      mode: 'fallback'
    })
    notifyWorkspace('Gemini fallback shown', aiQuestionError.value, 'warning')
    persistWorkspaceState()
  } finally {
    isAsking.value = false
  }
}

function findRelevantReferences(query: string, references: SourceReference[]) {
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 2)

  const scored = references
    .map((reference) => {
      const haystack = `${reference.file} ${reference.service} ${reference.description}`.toLowerCase()
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0)

      return { reference, score }
    })
    .sort((a, b) => b.score - a.score)

  const matched = scored.filter((item) => item.score > 0).slice(0, 3).map((item) => item.reference)

  return matched.length ? matched : references.slice(0, 3)
}

function formatLoc(loc: number) {
  if (loc >= 1_000_000) {
    return `${(loc / 1_000_000).toFixed(1)}M`
  }

  if (loc >= 1_000) {
    return `${Math.round(loc / 100) / 10}k`
  }

  return loc.toString()
}

function formatActivityTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatRecentAnalysisTime(date: Date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function clampScore(score: number) {
  return Math.max(40, Math.min(Math.round(score), 100))
}

function scoreTone(score: number): HealthSegment['tone'] {
  if (score >= 80) {
    return 'good'
  }

  if (score >= 68) {
    return 'watch'
  }

  return 'risk'
}

function isRecentAnalysis(value: unknown): value is RecentAnalysis {
  if (typeof value !== 'object' || !value) {
    return false
  }

  const item = value as Partial<RecentAnalysis>

  return (
    typeof item.id === 'string' &&
    typeof item.repository === 'string' &&
    typeof item.description === 'string' &&
    typeof item.score === 'number' &&
    typeof item.healthLabel === 'string' &&
    typeof item.analyzedAt === 'string' &&
    typeof item.meta === 'string'
  )
}

function isAiSessionItem(value: unknown): value is AiSessionItem {
  if (typeof value !== 'object' || !value) {
    return false
  }

  const item = value as Partial<AiSessionItem>

  return (
    typeof item.id === 'string' &&
    typeof item.question === 'string' &&
    typeof item.answer === 'string' &&
    typeof item.confidence === 'number' &&
    Array.isArray(item.references) &&
    typeof item.askedAt === 'string' &&
    (item.mode === 'gemini' || item.mode === 'fallback' || item.mode === 'demo')
  )
}

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (typeof value !== 'object' || !value) {
    return false
  }

  const item = value as Partial<StoredWorkspace>

  return (
    item.version === 1 &&
    typeof item.repository === 'string' &&
    typeof item.repoUrl === 'string' &&
    typeof item.prUrl === 'string' &&
    typeof item.activeSection === 'string' &&
    typeof item.lastAnalyzedAt === 'string' &&
    typeof item.answer === 'string' &&
    typeof item.lastQuestion === 'string' &&
    (typeof item.lastAiConfidence === 'number' || typeof item.lastAiConfidence === 'undefined') &&
    typeof item.lastSavedAt === 'string' &&
    Array.isArray(item.recentAnalyses) &&
    Array.isArray(item.activityLog) &&
    typeof item.settings === 'object' &&
    Boolean(item.settings)
  )
}

function isAbortError(error: unknown) {
  if (typeof error !== 'object' || !error) {
    return false
  }

  const namedError = error as { name?: unknown; message?: unknown; statusMessage?: unknown }
  const name = typeof namedError.name === 'string' ? namedError.name : ''
  const message = typeof namedError.message === 'string' ? namedError.message : ''
  const statusMessage = typeof namedError.statusMessage === 'string' ? namedError.statusMessage : ''

  return name === 'AbortError' || message.toLowerCase().includes('abort') || statusMessage.toLowerCase().includes('abort')
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'statusMessage' in error) {
    const message = (error as { statusMessage?: string }).statusMessage

    if (message) {
      return message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to analyze this repository.'
}

onMounted(() => {
  loadWorkspaceState()

  if (!recentAnalyses.value.length) {
    loadRecentAnalyses()
  }
})

onBeforeUnmount(() => {
  if (recentActionTimeout.value) {
    clearTimeout(recentActionTimeout.value)
  }

  stopAnalysisProgress(false)
})
</script>

<template>
  <div
    class="atlas-contours min-h-screen overflow-x-hidden bg-atlas-canvas text-atlas-ink"
    :aria-busy="isWorkspaceBusy"
  >
    <div v-if="isWorkspaceBusy" class="fixed inset-x-0 top-0 z-50 h-1 bg-atlas-accent/10" role="status" aria-live="polite">
      <span class="ui-span block h-full w-1/3 animate-atlas-progress rounded-r-full bg-atlas-accent"></span>
    </div>

    <Transition name="atlas-toast">
      <div
        v-if="isWorkspaceBusy || recentAction"
        class="fixed bottom-4 left-4 right-4 z-40 flex items-start gap-3 rounded-atlas bg-white/95 p-3 shadow-atlas ring-1 backdrop-blur md:left-auto md:w-[360px]"
        :class="activityToneClass"
        role="status"
        aria-live="polite"
      >
        <span
          class="ui-span mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          :class="isWorkspaceBusy ? 'animate-pulse bg-current' : 'bg-current'"
        ></span>
        <span class="ui-span min-w-0">
          <span class="ui-span block text-sm font-semibold">{{ workspaceActivity.label }}</span>
          <span class="ui-span mt-0.5 block text-xs leading-5 opacity-80">{{ workspaceActivity.detail }}</span>
        </span>
      </div>
    </Transition>

    <div class="flex min-h-screen flex-col lg:flex-row">
      <AppSidebar
        :active-section="activeSection"
        :nav-items="navItems"
        @change-section="changeSection"
      />

      <div class="min-w-0 flex-1">
        <CommandBar
          v-model:question="question"
          :activity-log="activityLog"
          :active-section-label="currentSection.label"
          :is-asking="isAsking"
          :is-demo-mode="isDemoMode"
          :repository-name="repositoryName"
          :saved-workspace-count="savedWorkspaces.length"
          :source-count="sourceReferences.length"
          @ask="askCodeAtlas"
          @clear-workspace="clearWorkspace"
          @export-report="exportCurrentReport('markdown')"
          @focus-command="handleUtilityAction('Command focused', 'Type a question and press Enter to ask CodeAtlas.')"
          @new-analysis="startNewAnalysis"
          @open-section="changeSection"
        />

        <main class="mx-auto flex max-w-[1640px] flex-col gap-5 px-4 py-6 md:px-7">
          <section class="flex flex-col gap-3 border-b border-atlas-line/80 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="atlas-muted-label">{{ currentSection.label }}</p>
              <h2 class="ui-title mt-1 text-[28px] leading-tight">{{ currentSection.label }}</h2>
              <p class="mt-1 max-w-2xl text-sm leading-6 text-atlas-muted">{{ pageDescription }}</p>
            </div>
            <span class="ui-span inline-flex w-fit items-center rounded-atlas border border-atlas-border bg-white/90 px-3 py-2 text-sm font-medium text-atlas-muted shadow-sm">
              {{ sectionMeta }}
            </span>
          </section>

          <Transition name="atlas-section" mode="out-in">
          <section v-if="activeSection === 'repository'" class="flex flex-col gap-4">
            <RepoAnalyzer
              v-model:repo-url="repoUrl"
              :is-analyzing="isAnalyzing"
              :last-analyzed-at="lastAnalyzedAt"
              :analysis-error="analysisError"
              @analyze="analyzeRepository"
              @view-report="changeSection('reports')"
            />

            <WorkspaceSetupPanel
              :steps="workspaceSetupSteps"
              :saved-workspace-count="savedWorkspaces.length"
              :last-saved-at="lastWorkspaceSavedAt"
              @action="handleWorkspaceSetupAction"
            />

            <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)_minmax(300px,360px)]">
              <RepositoryHealthScore
                :score="repositoryHealthScore"
                :label="repositoryHealthLabel"
                :repository-name="repositoryName"
                :segments="healthSegments"
              />
              <AnalysisTimeline
                :steps="analysisTimelineSteps"
                :is-busy="isAnalyzing"
                :updated-at="lastAnalyzedAt"
              />
              <RecentAnalyses
                class="xl:col-span-2 2xl:col-span-1"
                :analyses="recentAnalyses"
                :active-repository="repositoryName"
                @select="selectRecentAnalysis"
              />
            </section>

            <section class="atlas-panel overflow-hidden">
              <div class="flex flex-col gap-2 border-b border-atlas-line px-4 py-3 md:flex-row md:items-center md:justify-between">
                <h3 class="ui-title text-base">Repository snapshot</h3>
                <span class="ui-span text-xs text-atlas-muted">{{ lastAnalyzedAt }}</span>
              </div>
              <div class="grid grid-cols-1 divide-y divide-atlas-line md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
                <div v-for="stat in repositoryStats" :key="stat.label" class="min-w-0 px-4 py-4">
                  <p class="atlas-muted-label">{{ stat.label }}</p>
                  <span class="ui-span mt-2 block truncate text-xl font-semibold text-atlas-ink">{{ stat.value }}</span>
                  <p class="mt-2 line-clamp-2 text-sm leading-5 text-atlas-muted">{{ stat.detail }}</p>
                </div>
              </div>
            </section>

            <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
              <InsightFeed :insights="insightFeed" @open="changeSection" />
              <AiSummaryPanel
                :summary-items="summaryItems"
                :answer="answer"
                :references="sourceReferences"
                :context-references="aiContextReferences"
                :confidence="aiConfidence"
                :question="lastQuestion"
              />
            </section>

            <section class="grid grid-cols-1 gap-4">
              <SourceReferences :references="sourceReferences" />
            </section>
          </section>

          <section v-else-if="activeSection === 'architecture'" class="flex flex-col gap-4">
            <ArchitectureMap
              :nodes="architectureNodes"
              :references="sourceReferences"
              :risk-signals="riskSignals"
              @ask-node="askAboutArchitectureNode"
            />
            <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
              <InsightFeed :insights="insightFeed" @open="changeSection" />
              <AiSummaryPanel
                :summary-items="summaryItems"
                :answer="answer"
                :references="sourceReferences"
                :context-references="aiContextReferences"
                :confidence="aiConfidence"
                :question="lastQuestion"
              />
            </section>
            <SourceReferences :references="sourceReferences" />
          </section>

          <section v-else-if="activeSection === 'ask'" class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
            <section class="flex flex-col gap-4">
              <section class="atlas-panel overflow-hidden">
                <div class="border-b border-atlas-line px-4 py-3">
                  <h3 class="ui-title text-base">Question workspace</h3>
                </div>
                <form class="flex flex-col gap-3 px-4 py-4 md:flex-row" :aria-busy="isAsking" @submit.prevent="askCodeAtlas">
                  <label class="sr-only" for="codeatlas-question">Ask CodeAtlas</label>
                  <input
                    id="codeatlas-question"
                    v-model="question"
                    class="atlas-control min-w-0 flex-1"
                    type="search"
                    placeholder="Where is billing handled?"
                  >
                  <button
                    type="submit"
                    class="ui-button h-10 bg-atlas-ink px-4 text-white hover:bg-atlas-accent"
                    :disabled="isAsking"
                  >
                    <span v-if="isAsking" class="ui-span h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                    <span class="ui-span">{{ isAsking ? 'Asking...' : 'Ask Gemini' }}</span>
                  </button>
                </form>
                <div v-if="aiQuestionError" class="mx-4 mb-4 rounded-atlas border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800">
                  Gemini did not answer in time, so CodeAtlas showed the local source-reference fallback. {{ aiQuestionError }}
                </div>
                <div class="border-t border-atlas-line px-4 py-4">
                  <p class="text-sm leading-6 text-atlas-ink">{{ answer }}</p>
                </div>
              </section>

              <AiSessionPanel
                :items="aiSessionHistory"
                :suggestions="aiFollowUpPrompts"
                :is-asking="isAsking"
                @ask="askSuggestedQuestion"
                @select="selectAiSessionItem"
                @clear="clearAiSessionHistory"
              />
            </section>
            <section class="flex flex-col gap-4">
              <AiSummaryPanel
                :summary-items="summaryItems"
                :answer="answer"
                :references="sourceReferences"
                :context-references="aiContextReferences"
                :confidence="aiConfidence"
                :question="lastQuestion"
              />
              <SourceReferences :references="sourceReferences" />
            </section>
          </section>

          <section v-else-if="activeSection === 'pr-review'" class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <PrReviewPanel
              v-model:review-url="prUrl"
              :pull-requests="pullRequests"
              :risk-signals="riskSignals"
              :review="activePullRequestReview"
              :is-reviewing="isReviewingPr"
              :review-error="prReviewError"
              @review="reviewPullRequest"
            />
            <section class="atlas-panel h-fit overflow-hidden">
              <div class="border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">Review checklist</h3>
              </div>
              <div class="space-y-3 px-4 py-4">
                <div v-for="item in activePullRequestReview.checklist" :key="item" class="flex gap-3 rounded-atlas border border-atlas-border bg-atlas-canvas p-3">
                  <span class="ui-span mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-atlas-rail text-xs font-bold text-atlas-accent">-</span>
                  <p class="text-sm leading-5 text-atlas-ink">{{ item }}</p>
                </div>
              </div>
            </section>
          </section>

          <section v-else-if="activeSection === 'observability'" class="flex flex-col gap-4">
            <ObservabilityStrip :metrics="metrics" />
            <section class="atlas-panel overflow-hidden">
              <div class="border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">Metric details</h3>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[620px] text-left text-sm">
                  <thead class="bg-atlas-canvas text-xs font-medium text-atlas-muted">
                    <tr>
                      <th class="border-b border-atlas-line px-4 py-2 font-medium">Metric</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">Value</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">Delta</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="metric in metrics" :key="metric.label" class="border-b border-atlas-line last:border-0">
                      <td class="px-4 py-3 font-medium text-atlas-ink">{{ metric.label }}</td>
                      <td class="px-2 py-3 text-atlas-muted">{{ metric.value }}</td>
                      <td class="px-2 py-3">
                        <span class="ui-span rounded px-2 py-1 text-xs font-semibold" :class="metric.tone === 'good' ? 'bg-emerald-50 text-atlas-success' : 'bg-amber-50 text-amber-700'">
                          {{ metric.delta }}
                        </span>
                      </td>
                      <td class="px-2 py-3 text-atlas-muted">{{ metric.trend }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <section v-else-if="activeSection === 'bookmarks'" class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <section class="atlas-panel overflow-hidden">
              <div class="flex items-center justify-between border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">Saved references</h3>
                <span class="ui-span rounded-full bg-atlas-canvas px-2 py-0.5 text-xs font-semibold text-atlas-muted">{{ bookmarkedReferences.length }}</span>
              </div>
              <div class="divide-y divide-atlas-line">
                <article v-for="reference in bookmarkedReferences" :key="reference.file" class="px-4 py-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-atlas-ink">{{ reference.file }}</p>
                      <p class="mt-1 text-sm leading-5 text-atlas-muted">{{ reference.description }}</p>
                    </div>
                    <span class="ui-span rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{{ reference.priority }}</span>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2 text-xs text-atlas-muted">
                    <span class="ui-span rounded border border-atlas-border bg-white px-2 py-1">{{ reference.service }}</span>
                    <span class="ui-span rounded border border-atlas-border bg-white px-2 py-1">{{ reference.type }}</span>
                    <span class="ui-span rounded border border-atlas-border bg-white px-2 py-1">{{ reference.loc }} LOC</span>
                  </div>
                </article>
              </div>
            </section>

            <section class="atlas-panel h-fit overflow-hidden">
              <div class="border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">PR watchlist</h3>
              </div>
              <div class="divide-y divide-atlas-line">
                <button
                  v-for="pullRequest in pullRequests.slice(0, 4)"
                  :key="pullRequest.id"
                  type="button"
                  class="ui-button w-full justify-between rounded-none px-4 py-3 text-left hover:bg-atlas-canvas"
                  @click="openPullRequestReview(pullRequest)"
                >
                  <span class="ui-span min-w-0">
                    <span class="ui-span block truncate text-sm font-semibold text-atlas-ink">{{ pullRequest.id }} {{ pullRequest.title }}</span>
                    <span class="ui-span mt-1 block text-xs text-atlas-muted">{{ pullRequest.changedFiles }} files, checks {{ pullRequest.checks }}</span>
                  </span>
                  <span class="ui-span rounded px-2 py-1 text-xs font-semibold" :class="pullRequest.risk === 'High' ? 'bg-red-50 text-atlas-danger' : pullRequest.risk === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'">
                    {{ pullRequest.risk }}
                  </span>
                </button>
              </div>
            </section>
          </section>

          <section v-else-if="activeSection === 'reports'" class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <section class="atlas-panel overflow-hidden">
              <div class="flex flex-col gap-3 border-b border-atlas-line px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 class="ui-title text-base">Report center</h3>
                  <p class="mt-1 text-xs text-atlas-muted">Export a portfolio-ready package from the current workspace.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="ui-button h-9 border-atlas-accent bg-atlas-accent px-3 text-xs text-white shadow-instrument hover:bg-atlas-accentDark"
                    @click="exportCurrentReport('markdown')"
                  >
                    <span class="ui-span">Export Markdown</span>
                  </button>
                  <button
                    type="button"
                    class="ui-button h-9 border-atlas-border bg-white px-3 text-xs text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
                    @click="exportCurrentReport('json')"
                  >
                    <span class="ui-span">Export JSON</span>
                  </button>
                  <button
                    type="button"
                    class="ui-button h-9 border-atlas-border bg-white px-3 text-xs text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
                    @click="copyCurrentReport"
                  >
                    <span class="ui-span">Copy report</span>
                  </button>
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[620px] text-left text-sm">
                  <thead class="bg-atlas-canvas text-xs font-medium text-atlas-muted">
                    <tr>
                      <th class="border-b border-atlas-line px-4 py-2 font-medium">Report</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">Status</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">Scope</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="report in reportRows" :key="report.name" class="border-b border-atlas-line last:border-0">
                      <td class="px-4 py-3 font-medium text-atlas-ink">{{ report.name }}</td>
                      <td class="px-2 py-3">
                        <span class="ui-span rounded px-2 py-1 text-xs font-semibold" :class="report.status === 'Ready' ? 'bg-emerald-50 text-emerald-700' : report.status === 'Needs review' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-atlas-danger'">
                          {{ report.status }}
                        </span>
                      </td>
                      <td class="px-2 py-3 text-atlas-muted">{{ report.scope }}</td>
                      <td class="px-2 py-3 text-atlas-muted">{{ report.updated }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="border-t border-atlas-line bg-atlas-canvas px-4 py-3 text-xs leading-5 text-atlas-muted">
                Last export: {{ lastReportExportedAt }}. Reports include health score, architecture nodes, source citations, risks, and PR review.
              </div>
            </section>

            <AiSummaryPanel
              :summary-items="summaryItems"
              :answer="answer"
              :references="sourceReferences"
              :context-references="aiContextReferences"
              :confidence="aiConfidence"
              :question="lastQuestion"
            />
          </section>

          <section v-else-if="activeSection === 'integrations'" class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section v-for="integration in integrationRows" :key="integration.name" class="atlas-panel p-4">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <h3 class="ui-title text-base">{{ integration.name }}</h3>
                  <p class="mt-2 text-sm leading-5 text-atlas-muted">{{ integration.detail }}</p>
                </div>
                <span class="ui-span rounded bg-atlas-rail px-2 py-1 text-xs font-semibold text-atlas-accent">{{ integration.status }}</span>
              </div>
            </section>
          </section>

          <section v-else class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <section class="atlas-panel overflow-hidden">
              <div class="border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">Workspace settings</h3>
              </div>
              <div class="divide-y divide-atlas-line">
                <div v-for="setting in settingsToggles" :key="setting.key" class="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p class="font-semibold text-atlas-ink">{{ setting.label }}</p>
                    <p class="mt-1 text-sm leading-5 text-atlas-muted">{{ setting.detail }}</p>
                  </div>
                  <button
                    type="button"
                    class="ui-button h-8 w-14 justify-start rounded-full border-atlas-border px-1"
                    :class="setting.enabled ? 'bg-atlas-accent' : 'bg-atlas-canvas'"
                    :aria-label="`${setting.enabled ? 'Disable' : 'Enable'} ${setting.label}`"
                    :aria-pressed="setting.enabled"
                    @click="toggleWorkspaceSetting(setting.key)"
                  >
                    <span class="ui-span h-6 w-6 rounded-full bg-white shadow-sm transition" :class="setting.enabled ? 'translate-x-6' : 'translate-x-0'"></span>
                  </button>
                </div>
              </div>
            </section>

            <section class="atlas-panel h-fit overflow-hidden">
              <div class="border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">Workspace state</h3>
              </div>
              <div class="divide-y divide-atlas-line">
                <div v-for="row in settingsRows" :key="row.label" class="flex items-center justify-between gap-4 px-4 py-3">
                  <span class="ui-span text-sm text-atlas-muted">{{ row.label }}</span>
                  <span class="ui-span truncate text-sm font-semibold text-atlas-ink">{{ row.value }}</span>
                </div>
              </div>
            </section>
          </section>
          </Transition>
        </main>
      </div>
    </div>
  </div>
</template>
