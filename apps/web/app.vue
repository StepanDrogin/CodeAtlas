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
  NavItem,
  NavSection,
  PullRequest,
  PullRequestReview,
  RecentAnalysis,
  RepositoryAnalysis,
  SavedReference,
  SavedReferencePriority,
  SourceReference,
  WorkspaceSetupStep
} from '~/types/codeatlas'
import {
  CODEATLAS_LOCALE_STORAGE_KEY,
  CODEATLAS_THEME_STORAGE_KEY
} from '~/composables/useCodeAtlasPreferences'
import {
  isCodeAtlasLocale,
  isCodeAtlasThemePreference,
  type CodeAtlasMessageKey,
  type CodeAtlasResolvedTheme
} from '~/utils/codeatlas-i18n'

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
  savedReferences: SavedReference[]
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
const SAVED_REFERENCE_PRIORITIES: SavedReferencePriority[] = ['Critical path', 'Architecture', 'API boundary', 'Review context', 'Watch']
const NAV_LABEL_KEYS: Record<NavSection, CodeAtlasMessageKey> = {
  repository: 'nav.repository',
  architecture: 'nav.architecture',
  ask: 'nav.ask',
  'pr-review': 'nav.prReview',
  observability: 'nav.observability',
  bookmarks: 'nav.bookmarks',
  reports: 'nav.reports',
  integrations: 'nav.integrations',
  settings: 'nav.settings'
}
const PAGE_DESCRIPTION_KEYS: Record<NavSection, CodeAtlasMessageKey> = {
  repository: 'page.repository',
  architecture: 'page.architecture',
  ask: 'page.ask',
  'pr-review': 'page.prReview',
  observability: 'page.observability',
  bookmarks: 'page.bookmarks',
  reports: 'page.reports',
  integrations: 'page.integrations',
  settings: 'page.settings'
}
const TIMELINE_LABEL_KEYS: Record<typeof ANALYSIS_TIMELINE_BASE[number]['id'], CodeAtlasMessageKey> = {
  connect: 'timeline.connect.label',
  index: 'timeline.index.label',
  architecture: 'timeline.architecture.label',
  risk: 'timeline.risk.label',
  ai: 'timeline.ai.label'
}
const TIMELINE_DETAIL_KEYS: Record<typeof ANALYSIS_TIMELINE_BASE[number]['id'], CodeAtlasMessageKey> = {
  connect: 'timeline.connect.detail',
  index: 'timeline.index.detail',
  architecture: 'timeline.architecture.detail',
  risk: 'timeline.risk.detail',
  ai: 'timeline.ai.detail'
}
const SAVED_REFERENCE_PRIORITY_LABEL_KEYS: Record<SavedReferencePriority, CodeAtlasMessageKey> = {
  'Critical path': 'priority.critical',
  Architecture: 'priority.architecture',
  'API boundary': 'priority.api',
  'Review context': 'priority.review',
  Watch: 'priority.watch'
}

const config = useRuntimeConfig()
const {
  activeTheme,
  activeThemeLabel,
  formatNumber,
  locale,
  localeOptions,
  localeTag,
  setLocale,
  setThemePreference,
  t,
  themeOptions,
  themePreference
} = useCodeAtlasI18n()
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
const savedReferences = ref<SavedReference[]>([])
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
const preferencesReady = ref(false)
let themeMediaQuery: MediaQueryList | null = null

const localizedNavItems = computed<NavItem[]>(() => navItems.map((item) => ({
  ...item,
  label: t(NAV_LABEL_KEYS[item.id])
})))

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
const currentSection = computed(() => localizedNavItems.value.find((item) => item.id === activeSection.value) ?? {
  id: 'repository' as const,
  label: t('nav.repository'),
  icon: 'repository'
})
const repositoryName = computed(() => analysis.value?.repository.fullName ?? normalizeRepositoryFullName(repoUrl.value) ?? 'nuxt/nuxt')
const repositoryDescription = computed(
  () => analysis.value?.repository.description || t('repository.descriptionFallback')
)
const sectionMeta = computed(() => {
  switch (activeSection.value) {
    case 'architecture':
      return `${formatNumber(architectureNodes.value.length)} ${t('architecture.title')}`
    case 'ask':
      return isDemoMode.value ? t('status.demoFallback') : t('integrations.serverRoute')
    case 'pr-review':
      return `${formatNumber(pullRequests.value.length)} ${t('pr.openPullRequests').toLowerCase()}`
    case 'observability':
      return `${formatNumber(metrics.length)} ${t('observability.metric').toLowerCase()}`
    case 'bookmarks':
      return savedReferences.value.length
        ? `${formatNumber(savedReferences.value.length)} ${t('bookmarks.savedReferences').toLowerCase()}`
        : `${formatNumber(bookmarkedReferences.value.length)} ${t('bookmarks.suggested').toLowerCase()}`
    case 'reports':
      return `${formatNumber(reportRows.value.length)} ${t('nav.reports').toLowerCase()}`
    case 'integrations':
      return `${formatNumber(integrationRows.value.length)} ${t('nav.integrations').toLowerCase()}`
    case 'settings':
      return t('settings.preferences')
    default:
      return repositoryName.value
  }
})
const repositoryStats = computed(() => {
  const repository = analysis.value?.repository

  return [
    {
      label: t('common.repository'),
      value: repositoryName.value,
      detail: repositoryDescription.value
    },
    {
      label: t('common.language'),
      value: repository?.language ?? 'TypeScript',
      detail: t('repository.defaultBranch', { branch: repository?.defaultBranch ?? 'main' })
    },
    {
      label: t('common.files'),
      value: formatNumber(repository?.fileCount ?? 1842),
      detail: t('repository.filesDetail', { loc: formatLoc(repository?.estimatedLoc ?? 612000) })
    },
    {
      label: 'Community',
      value: `${formatNumber(repository?.stars ?? 12400)} stars`,
      detail: t('repository.communityDetail', { forks: formatNumber(repository?.forks ?? 920) })
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
      label: t('health.architecture'),
      score: architectureScore,
      value: `${architectureNodes.value.length} nodes`,
      detail: t('health.architectureDetail'),
      tone: scoreTone(architectureScore)
    },
    {
      label: t('health.maintainability'),
      score: maintainabilityScore,
      value: `${sourceReferences.value.length} refs`,
      detail: t('health.maintainabilityDetail'),
      tone: scoreTone(maintainabilityScore)
    },
    {
      label: t('health.security'),
      score: securityScore,
      value: securitySignals ? `${securitySignals} signals` : t('health.clear'),
      detail: t('health.securityDetail'),
      tone: scoreTone(securityScore)
    },
    {
      label: t('health.testability'),
      score: testabilityScore,
      value: testSignals ? t('health.watch') : t('health.stable'),
      detail: t('health.testabilityDetail'),
      tone: scoreTone(testabilityScore)
    },
    {
      label: t('health.operations'),
      score: operationsScore,
      value: isDemoMode.value ? t('common.demo') : t('common.liveApi'),
      detail: t('health.operationsDetail'),
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
    return t('health.excellent')
  }

  if (repositoryHealthScore.value >= 80) {
    return t('health.healthy')
  }

  if (repositoryHealthScore.value >= 68) {
    return t('health.watch')
  }

  return t('health.risky')
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
      label: t(TIMELINE_LABEL_KEYS[step.id]),
      detail: t(TIMELINE_DETAIL_KEYS[step.id]),
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
      label: t('insights.healthLabel', { label: repositoryHealthLabel.value }),
      detail: t('insights.healthDetail', { score: repositoryHealthScore.value }),
      tone: repositoryHealthScore.value >= 80 ? 'good' : repositoryHealthScore.value >= 68 ? 'warning' : 'risk',
      section: 'reports',
      action: t('insights.openReports')
    },
    {
      id: 'risk',
      label: risk ? t('insights.topRisk') : t('insights.cleanRisk'),
      detail: risk ?? t('insights.cleanRiskDetail'),
      tone: risk ? 'risk' : 'good',
      section: risk ? 'pr-review' : 'architecture',
      action: risk ? t('insights.reviewRisk') : t('insights.inspectArchitecture')
    },
    {
      id: 'pr',
      label: highRiskPullRequest ? t('insights.escalatedPr', { id: highRiskPullRequest.id }) : t('insights.prReady'),
      detail: highRiskPullRequest
        ? t('insights.prDetail', { title: highRiskPullRequest.title, count: highRiskPullRequest.changedFiles })
        : t('insights.prReadyDetail', { count: pullRequests.value.length }),
      tone: highRiskPullRequest ? 'warning' : 'info',
      section: 'pr-review',
      action: t('insights.openPrReview')
    },
    {
      id: 'opportunity',
      label: opportunity?.label ?? t('insights.nextOpportunity'),
      detail: opportunity?.text ?? t('insights.nextOpportunityDetail'),
      tone: 'info',
      section: 'ask',
      action: t('insights.askCodeAtlas')
    },
    {
      id: 'strength',
      label: strength?.label ?? t('insights.strengthDetected'),
      detail: strength?.text ?? t('insights.strengthDetail'),
      tone: 'good'
    }
  ]
})
const savedReferenceFiles = computed(() => savedReferences.value.map((reference) => reference.file))
const savedReferencePriorityLabel = (priority: SavedReferencePriority) => t(SAVED_REFERENCE_PRIORITY_LABEL_KEYS[priority])
const bookmarkedReferences = computed<SavedReference[]>(() => {
  const suggestedReferences = sourceReferences.value
    .filter((reference) => !savedReferenceFiles.value.includes(reference.file))
    .slice(0, Math.max(0, 4 - savedReferences.value.length))
    .map((reference, index) => createSavedReference(reference, SAVED_REFERENCE_PRIORITIES[index] ?? 'Watch'))

  return [...savedReferences.value, ...suggestedReferences]
})
const reportRows = computed(() => [
  {
    name: t('reports.architectureBrief'),
    status: 'ready',
    statusLabel: t('reports.ready'),
    scope: `${architectureNodes.value.length} nodes`,
    updated: lastAnalyzedAt.value
  },
  {
    name: t('reports.riskRegister'),
    status: riskSignals.value.length ? 'review' : 'ready',
    statusLabel: riskSignals.value.length ? t('reports.needsReview') : t('reports.ready'),
    scope: `${riskSignals.value.length} signals`,
    updated: activePullRequestReview.value.analyzedAt
  },
  {
    name: t('reports.prReviewPack'),
    status: activePullRequestReview.value.risk === 'High' ? 'escalated' : 'ready',
    statusLabel: activePullRequestReview.value.risk === 'High' ? t('reports.escalated') : t('reports.ready'),
    scope: `${activePullRequestReview.value.changedFiles} files changed`,
    updated: activePullRequestReview.value.id
  }
])
const workspaceSetupSteps = computed<WorkspaceSetupStep[]>(() => [
  {
    id: 'connect',
    label: t('setup.connect.label'),
    detail: analysis.value ? t('setup.connect.live', { repository: repositoryName.value }) : t('setup.connect.demo'),
    status: analysis.value || repoUrl.value ? 'done' : 'active',
    action: t('setup.connect.action')
  },
  {
    id: 'analyze',
    label: t('setup.analyze.label'),
    detail: analysis.value
      ? t('setup.analyze.live', { sources: sourceReferences.value.length, nodes: architectureNodes.value.length })
      : t('setup.analyze.demo'),
    status: analysis.value ? 'done' : 'active',
    action: analysis.value ? t('setup.analyze.actionReady') : t('setup.analyze.actionIdle')
  },
  {
    id: 'ask',
    label: t('setup.ask.label'),
    detail: aiSessionHistory.value.length ? t('setup.ask.live', { count: aiSessionHistory.value.length }) : t('setup.ask.demo'),
    status: aiSessionHistory.value.length ? 'done' : analysis.value ? 'active' : 'pending',
    action: t('setup.ask.action')
  },
  {
    id: 'export',
    label: t('setup.export.label'),
    detail: lastReportExportedAt.value === 'Not exported yet' ? t('setup.export.idle') : t('setup.export.done', { time: lastReportExportedAt.value }),
    status: lastReportExportedAt.value === 'Not exported yet' ? 'pending' : 'done',
    action: t('setup.export.action')
  }
])
const aiFollowUpPrompts = computed(() => {
  const primaryReference = savedReferences.value[0] ?? aiContextReferences.value[0] ?? sourceReferences.value[0]
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
  const saved = savedReferences.value.length
    ? savedReferences.value.map((reference) => `- \`${reference.file}\` (${savedReferencePriorityLabel(reference.priority)}): ${reference.note || reference.description}`).join('\n')
    : '- No saved references yet.'
  const nodes = architectureNodes.value.map((node) => `- ${node.label} (${node.kind}): ${node.detail}`).join('\n')
  const sessions = aiSessionHistory.value.length
    ? aiSessionHistory.value.map((item) => `- **${item.question}** (${item.mode}, ${item.confidence}%): ${item.references.slice(0, 3).map((reference) => `\`${reference.file}\``).join(', ') || 'No source references'}`).join('\n')
    : '- No AI session questions saved yet.'
  const pr = activePullRequestReview.value

  return `# CodeAtlas Report: ${repositoryName.value}

Generated: ${new Date().toLocaleString(localeTag.value)}
Mode: ${isDemoMode.value ? 'Demo fallback' : 'Live API'}
Health: ${repositoryHealthScore.value}/100 (${repositoryHealthLabel.value})

## Repository

- URL: ${repository?.url ?? `https://github.com/${repositoryName.value}`}
- Language: ${repository?.language ?? 'TypeScript'}
- Files: ${formatNumber(repository?.fileCount ?? 1842)}
- Estimated LOC: ${formatLoc(repository?.estimatedLoc ?? 612000)}
- Stars: ${formatNumber(repository?.stars ?? 12400)}

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

## Saved References

${saved}

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
    status: analysis.value ? t('integrations.synced') : t('reports.ready'),
    detail: t('integrations.githubDetail', { references: sourceReferences.value.length, pullRequests: pullRequests.value.length })
  },
  {
    name: 'Gemini',
    status: isDemoMode.value ? t('status.demoFallback') : t('integrations.serverRoute'),
    detail: t('integrations.geminiDetail')
  },
  {
    name: 'Vercel',
    status: t('integrations.production'),
    detail: t('integrations.vercelDetail')
  },
  {
    name: 'Local API',
    status: t('integrations.development'),
    detail: t('integrations.localDetail')
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
    label: t('settings.autoReview'),
    detail: t('settings.autoReviewDetail'),
    enabled: workspaceSettings.autoReview
  },
  {
    key: 'strictSignals',
    label: t('settings.strictSignals'),
    detail: t('settings.strictSignalsDetail'),
    enabled: workspaceSettings.strictSignals
  },
  {
    key: 'privateRepoIndexing',
    label: t('settings.privateRepoIndexing'),
    detail: t('settings.privateRepoIndexingDetail'),
    enabled: workspaceSettings.privateRepoIndexing
  }
])
const settingsRows = computed(() => [
  { label: t('common.mode'), value: isDemoMode.value ? t('status.staticDemo') : t('common.liveServer') },
  { label: t('common.repository'), value: repositoryName.value },
  { label: t('settings.prSource'), value: activePullRequestReview.value.repositoryFullName },
  { label: t('settings.aiProvider'), value: isDemoMode.value ? t('status.demoFallback') : t('status.googleGemini') },
  { label: t('settings.aiSessions'), value: aiSessionHistory.value.length.toString() },
  { label: t('settings.savedReferences'), value: savedReferences.value.length.toString() },
  { label: t('settings.savedWorkspaces'), value: savedWorkspaces.value.length.toString() },
  { label: t('common.language'), value: localeOptions.find((option) => option.code === locale.value)?.nativeLabel ?? locale.value },
  { label: t('settings.theme'), value: t(themeOptions.find((option) => option.code === themePreference.value)?.labelKey ?? 'theme.system') },
  { label: t('settings.activeTheme'), value: activeThemeLabel.value },
  { label: t('settings.lastExport'), value: lastReportExportedAt.value === 'Not exported yet' ? t('status.notExported') : lastReportExportedAt.value }
])
const lastWorkspaceSavedLabel = computed(() => lastWorkspaceSavedAt.value === 'Not saved yet' ? t('status.notSaved') : lastWorkspaceSavedAt.value)

const isWorkspaceBusy = computed(() => isAnalyzing.value || isReviewingPr.value || isAsking.value)
const workspaceActivity = computed<WorkspaceActivity>(() => {
  if (isAnalyzing.value) {
    return {
      label: t('workspace.analyzing'),
      detail: t('workspace.analyzingDetail'),
      tone: 'warning'
    }
  }

  if (isReviewingPr.value) {
    return {
      label: t('workspace.reviewing'),
      detail: t('workspace.reviewingDetail'),
      tone: 'warning'
    }
  }

  if (isAsking.value) {
    return {
      label: t('workspace.asking'),
      detail: t('workspace.askingDetail'),
      tone: 'info'
    }
  }

  return recentAction.value ?? {
    label: t('workspace.ready'),
    detail: t('workspace.readyDetail'),
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
  return t(PAGE_DESCRIPTION_KEYS[activeSection.value])
})

useHead(() => ({
  htmlAttrs: {
    lang: locale.value
  },
  title: pageTitle.value,
  meta: [
    { name: 'description', content: pageDescription.value },
    { name: 'application-name', content: 'CodeAtlas' },
    { name: 'author', content: 'Stepan Drogin' },
    { name: 'robots', content: 'index, follow, max-image-preview:large' },
    { name: 'theme-color', content: activeTheme.value === 'dark' ? '#141b25' : '#007f78' },
    { name: 'color-scheme', content: activeTheme.value },
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

const resolveThemePreference = (): CodeAtlasResolvedTheme => {
  if (themePreference.value === 'system') {
    return themeMediaQuery?.matches ? 'dark' : 'light'
  }

  return themePreference.value
}

const applyThemePreference = () => {
  if (!import.meta.client) {
    return
  }

  const resolvedTheme = resolveThemePreference()
  activeTheme.value = resolvedTheme
  document.documentElement.classList.toggle('theme-dark', resolvedTheme === 'dark')
  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.dataset.themePreference = themePreference.value
  document.documentElement.lang = locale.value
  document.documentElement.style.colorScheme = resolvedTheme
}

const loadUserPreferences = () => {
  if (!import.meta.client) {
    return
  }

  const storedLocale = window.localStorage.getItem(CODEATLAS_LOCALE_STORAGE_KEY)
  const storedTheme = window.localStorage.getItem(CODEATLAS_THEME_STORAGE_KEY)

  if (isCodeAtlasLocale(storedLocale)) {
    setLocale(storedLocale)
  }

  if (isCodeAtlasThemePreference(storedTheme)) {
    setThemePreference(storedTheme)
  }

  themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  themeMediaQuery.addEventListener('change', applyThemePreference)
  applyThemePreference()
  window.setTimeout(() => {
    preferencesReady.value = true
  }, 0)
}

const persistUserPreferences = () => {
  if (!import.meta.client) {
    return
  }

  window.localStorage.setItem(CODEATLAS_LOCALE_STORAGE_KEY, locale.value)
  window.localStorage.setItem(CODEATLAS_THEME_STORAGE_KEY, themePreference.value)
}

const handleLocaleInput = (event: Event) => {
  setLocale((event.target as HTMLSelectElement).value)
}

const handleThemeInput = (event: Event) => {
  setThemePreference((event.target as HTMLSelectElement).value)
}

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

watch(locale, (value, previousValue) => {
  if (!import.meta.client) {
    return
  }

  document.documentElement.lang = value
  persistUserPreferences()

  if (preferencesReady.value && value !== previousValue) {
    const language = localeOptions.find((option) => option.code === value)?.nativeLabel ?? value
    notifyWorkspace(t('notify.languageChanged'), t('notify.languageChangedDetail', { language }), 'success')
  }
})

watch(themePreference, (value, previousValue) => {
  applyThemePreference()
  persistUserPreferences()

  if (preferencesReady.value && value !== previousValue) {
    const theme = t(themeOptions.find((option) => option.code === value)?.labelKey ?? 'theme.system')
    notifyWorkspace(t('notify.themeChanged'), t('notify.themeChangedDetail', { theme }), 'success')
  }
})

const changeSection = (section: NavSection) => {
  activeSection.value = section
  const target = localizedNavItems.value.find((item) => item.id === section)

  notifyWorkspace(t('notify.sectionSwitched'), target?.label ?? t('notify.sectionDetail'), 'info')
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
  notifyWorkspace(t('notify.newAnalysis'), t('notify.newAnalysisDetail'), 'info')
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
  notifyWorkspace(t('notify.recentSelected'), t('notify.recentSelectedDetail', { repository }), 'info')
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
  savedReferences: savedReferences.value.slice(0, 12),
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
  savedReferences.value = snapshot.savedReferences?.filter(isSavedReference).slice(0, 12) ?? []
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
  notifyWorkspace(t('notify.workspaceRestored'), t('notify.workspaceRestoredDetail', { repository }), 'success')

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
    meta: `${formatNumber(repository?.fileCount ?? 1842)} ${t('common.files').toLowerCase()} - ${formatLoc(repository?.estimatedLoc ?? 612000)} ${t('common.loc')}`
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
    workspaceSettings[key] ? t('notify.settingEnabled') : t('notify.settingDisabled'),
    settingsToggles.value.find((setting) => setting.key === key)?.label ?? t('notify.preferenceUpdated'),
    'success'
  )
  persistWorkspaceState()
}

const openPullRequestReview = (pullRequest: PullRequest) => {
  if (pullRequest.url) {
    prUrl.value = pullRequest.url
  }

  changeSection('pr-review')
  notifyWorkspace(t('notify.prSelected'), t('notify.prSelectedDetail', { id: pullRequest.id }), 'info')
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
          savedReferences: savedReferences.value,
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
  notifyWorkspace(t('notify.reportExported'), t('notify.reportExportedDetail', {
    format: isJson ? 'JSON' : 'Markdown',
    repository: repositoryName.value
  }), 'success')
  persistWorkspaceState()
}

const copyCurrentReport = async () => {
  try {
    await navigator.clipboard.writeText(reportMarkdown.value)
    lastReportExportedAt.value = formatRecentAnalysisTime(new Date())
    notifyWorkspace(t('notify.reportCopied'), t('notify.reportCopiedDetail'), 'success')
    persistWorkspaceState()
  } catch {
    notifyWorkspace(t('notify.copyFailed'), t('notify.copyFailedDetail'), 'warning')
  }
}

const clearWorkspace = () => {
  analysis.value = null
  prReview.value = null
  aiSessionHistory.value = []
  savedReferences.value = []
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

  notifyWorkspace(t('notify.workspaceCleared'), t('notify.workspaceClearedDetail'), 'info')
}

function createSavedReference(reference: SourceReference, priority: SavedReferencePriority = 'Watch'): SavedReference {
  return {
    ...reference,
    priority,
    note: reference.description,
    savedAt: formatRecentAnalysisTime(new Date())
  }
}

const saveSourceReference = (reference: SourceReference) => {
  const existing = savedReferences.value.find((savedReference) => savedReference.file === reference.file)

  if (existing) {
    notifyWorkspace(t('notify.referenceAlreadySaved'), t('notify.referenceAlreadySavedDetail', { file: reference.file }), 'info')
    changeSection('bookmarks')

    return
  }

  const priority = savedReferences.value.length < SAVED_REFERENCE_PRIORITIES.length
    ? SAVED_REFERENCE_PRIORITIES[savedReferences.value.length]
    : 'Watch'

  savedReferences.value = [
    createSavedReference(reference, priority),
    ...savedReferences.value
  ].slice(0, 12)
  notifyWorkspace(t('notify.referenceSaved'), t('notify.referenceSavedDetail', { file: reference.file }), 'success')
  persistWorkspaceState()
}

const removeSavedReference = (file: string) => {
  savedReferences.value = savedReferences.value.filter((reference) => reference.file !== file)
  notifyWorkspace(t('notify.referenceRemoved'), t('notify.referenceRemovedDetail', { file }), 'info')
  persistWorkspaceState()
}

const updateSavedReferencePriority = (file: string, priority: string) => {
  if (!SAVED_REFERENCE_PRIORITIES.includes(priority as SavedReferencePriority)) {
    return
  }

  savedReferences.value = savedReferences.value.map((reference) =>
    reference.file === file ? { ...reference, priority: priority as SavedReferencePriority } : reference
  )
  persistWorkspaceState()
}

const updateSavedReferenceNote = (file: string, note: string) => {
  savedReferences.value = savedReferences.value.map((reference) =>
    reference.file === file ? { ...reference, note } : reference
  )
  persistWorkspaceState()
}

const handleSavedReferencePriorityInput = (file: string, event: Event) => {
  const target = event.target as HTMLSelectElement | null

  if (target) {
    updateSavedReferencePriority(file, target.value)
  }
}

const handleSavedReferenceNoteInput = (file: string, event: Event) => {
  const target = event.target as HTMLTextAreaElement | null

  if (target) {
    updateSavedReferenceNote(file, target.value)
  }
}

const askAboutSourceReference = async (reference: SourceReference) => {
  question.value = `Explain ${reference.file}: purpose, dependencies, risks, and tests.`
  lastQuestion.value = question.value
  lastMatchedReferences.value = findRelevantReferences(`${reference.file} ${reference.service} ${reference.description}`, sourceReferences.value)
  lastAiConfidence.value = Math.max(58, Math.min(92, 62 + lastMatchedReferences.value.length * 8 - riskSignals.value.length * 2))
  changeSection('ask')
  notifyWorkspace(t('notify.referenceQuestionPrepared'), t('notify.referenceQuestionPreparedDetail', { file: reference.file }), 'info')
  await nextTick()
  document.getElementById('codeatlas-question')?.focus()
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
  notifyWorkspace(t('notify.aiAnswerRestored'), t('notify.aiAnswerRestoredDetail', { count: item.references.length }), 'info')
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
  notifyWorkspace(t('notify.aiSessionCleared'), t('notify.aiSessionClearedDetail'), 'info')
  persistWorkspaceState()
}

const askAboutArchitectureNode = async (node: { label: string; detail: string }) => {
  question.value = `Explain ${node.label}: responsibilities, source files, risks, and tests.`
  lastQuestion.value = question.value
  lastMatchedReferences.value = findRelevantReferences(`${node.label} ${node.detail}`, sourceReferences.value)
  lastAiConfidence.value = Math.max(58, Math.min(92, 62 + lastMatchedReferences.value.length * 8 - riskSignals.value.length * 2))
  changeSection('ask')
  notifyWorkspace(t('notify.nodeQuestionPrepared'), t('notify.nodeQuestionPreparedDetail', { node: node.label }), 'info')
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
      savedReferences.value = []
      lastQuestion.value = ''
      lastMatchedReferences.value = []
      lastAiConfidence.value = 82
      aiQuestionError.value = ''
    }
    answer.value = result.answer
    lastAnalyzedAt.value = `Completed just now - ${formatNumber(result.repository.fileCount)} ${t('common.files').toLowerCase()} - ${formatLoc(result.repository.estimatedLoc)} ${t('common.loc')}`
    recordRecentAnalysis()
    notifyWorkspace(t('notify.analysisComplete'), t('notify.analysisCompleteDetail', { repository: result.repository.fullName }), 'success')
    persistWorkspaceState()
    succeeded = true
  } catch (error) {
    analysisError.value = getErrorMessage(error)
    lastAnalyzedAt.value = 'Analysis failed'
    notifyWorkspace(t('notify.analysisFailed'), analysisError.value, 'danger')
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

    notifyWorkspace(t('notify.prComplete'), t('notify.prCompleteDetail', { repository: prReview.value.repositoryFullName, id: prReview.value.id }), 'success')
    persistWorkspaceState()
  } catch (error) {
    prReviewError.value = getErrorMessage(error)
    notifyWorkspace(t('notify.prFailed'), prReviewError.value, 'danger')
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
    notifyWorkspace(t('notify.localAnswerReady'), t('notify.localAnswerReadyDetail'), 'success')
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
    notifyWorkspace(t('notify.geminiAnswerReady'), t('notify.geminiAnswerReadyDetail'), 'success')
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
    notifyWorkspace(t('notify.geminiFallbackShown'), aiQuestionError.value, 'warning')
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

function isSavedReference(value: unknown): value is SavedReference {
  if (typeof value !== 'object' || !value) {
    return false
  }

  const item = value as Partial<SavedReference>

  return (
    typeof item.file === 'string' &&
    typeof item.type === 'string' &&
    typeof item.service === 'string' &&
    typeof item.description === 'string' &&
    typeof item.loc === 'number' &&
    typeof item.updated === 'string' &&
    typeof item.note === 'string' &&
    typeof item.savedAt === 'string' &&
    typeof item.priority === 'string' &&
    SAVED_REFERENCE_PRIORITIES.includes(item.priority as SavedReferencePriority)
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
  loadUserPreferences()
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
  themeMediaQuery?.removeEventListener('change', applyThemePreference)
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
        :nav-items="localizedNavItems"
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
          @focus-command="handleUtilityAction(t('notify.commandFocused'), t('notify.commandFocusedDetail'))"
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
              :last-saved-at="lastWorkspaceSavedLabel"
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
                <h3 class="ui-title text-base">{{ t('repository.snapshot') }}</h3>
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
              <SourceReferences
                :references="sourceReferences"
                :saved-files="savedReferenceFiles"
                @save="saveSourceReference"
                @ask="askAboutSourceReference"
              />
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
            <SourceReferences
              :references="sourceReferences"
              :saved-files="savedReferenceFiles"
              @save="saveSourceReference"
              @ask="askAboutSourceReference"
            />
          </section>

          <section v-else-if="activeSection === 'ask'" class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
            <section class="flex flex-col gap-4">
              <section class="atlas-panel overflow-hidden">
                <div class="border-b border-atlas-line px-4 py-3">
                  <h3 class="ui-title text-base">{{ t('ask.workspace') }}</h3>
                </div>
                <form class="flex flex-col gap-3 px-4 py-4 md:flex-row" :aria-busy="isAsking" @submit.prevent="askCodeAtlas">
                  <label class="sr-only" for="codeatlas-question">{{ t('ask.label') }}</label>
                  <input
                    id="codeatlas-question"
                    v-model="question"
                    class="atlas-control min-w-0 flex-1"
                    type="search"
                    :placeholder="t('ask.placeholder')"
                  >
                  <button
                    type="submit"
                    class="ui-button h-10 bg-atlas-ink px-4 text-white hover:bg-atlas-accent"
                    :disabled="isAsking"
                  >
                    <span v-if="isAsking" class="ui-span h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                    <span class="ui-span">{{ isAsking ? t('ask.asking') : t('ask.gemini') }}</span>
                  </button>
                </form>
                <div v-if="aiQuestionError" class="mx-4 mb-4 rounded-atlas border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800">
                  {{ t('ask.timeout', { error: aiQuestionError }) }}
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
              <SourceReferences
                :references="sourceReferences"
                :saved-files="savedReferenceFiles"
                @save="saveSourceReference"
                @ask="askAboutSourceReference"
              />
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
                <h3 class="ui-title text-base">{{ t('pr.reviewChecklist') }}</h3>
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
                <h3 class="ui-title text-base">{{ t('observability.metricDetails') }}</h3>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[620px] text-left text-sm">
                  <thead class="bg-atlas-canvas text-xs font-medium text-atlas-muted">
                    <tr>
                      <th class="border-b border-atlas-line px-4 py-2 font-medium">{{ t('observability.metric') }}</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">{{ t('common.value') }}</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">{{ t('observability.delta') }}</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">{{ t('observability.trend') }}</th>
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
              <div class="flex flex-col gap-3 border-b border-atlas-line px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 class="ui-title text-base">{{ t('bookmarks.savedReferences') }}</h3>
                  <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ t('bookmarks.detail') }}</p>
                </div>
                <span class="ui-span w-fit rounded-full bg-atlas-canvas px-2 py-0.5 text-xs font-semibold text-atlas-muted">{{ bookmarkedReferences.length }}</span>
              </div>
              <div class="divide-y divide-atlas-line">
                <article v-for="reference in bookmarkedReferences" :key="reference.file" class="px-4 py-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-atlas-ink">{{ reference.file }}</p>
                      <p class="mt-1 text-sm leading-5 text-atlas-muted">{{ reference.description }}</p>
                    </div>
                    <select
                      class="atlas-control h-8 w-full text-xs sm:w-40"
                      :value="reference.priority"
                      :disabled="!savedReferenceFiles.includes(reference.file)"
                      @change="handleSavedReferencePriorityInput(reference.file, $event)"
                    >
                      <option v-for="priority in SAVED_REFERENCE_PRIORITIES" :key="priority" :value="priority">
                        {{ savedReferencePriorityLabel(priority) }}
                      </option>
                    </select>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2 text-xs text-atlas-muted">
                    <span class="ui-span rounded border border-atlas-border bg-white px-2 py-1">{{ reference.service }}</span>
                    <span class="ui-span rounded border border-atlas-border bg-white px-2 py-1">{{ reference.type }}</span>
                    <span class="ui-span rounded border border-atlas-border bg-white px-2 py-1">{{ reference.loc }} LOC</span>
                    <span class="ui-span rounded border border-atlas-border bg-white px-2 py-1">
                      {{ savedReferenceFiles.includes(reference.file) ? t('bookmarks.savedAt', { time: reference.savedAt }) : t('bookmarks.suggested') }}
                    </span>
                  </div>
                  <textarea
                    class="atlas-control mt-3 min-h-20 w-full py-2 leading-5 disabled:bg-atlas-canvas disabled:text-atlas-muted"
                    :value="reference.note"
                    :disabled="!savedReferenceFiles.includes(reference.file)"
                    :placeholder="t('bookmarks.notePlaceholder')"
                    @input="handleSavedReferenceNoteInput(reference.file, $event)"
                  ></textarea>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="ui-button h-9 border-atlas-border bg-white px-3 text-xs text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
                      @click="askAboutSourceReference(reference)"
                    >
                      <span class="ui-span">{{ t('bookmarks.askFile') }}</span>
                    </button>
                    <button
                      v-if="savedReferenceFiles.includes(reference.file)"
                      type="button"
                      class="ui-button h-9 border-atlas-border bg-white px-3 text-xs text-atlas-muted hover:border-atlas-danger hover:text-atlas-danger"
                      @click="removeSavedReference(reference.file)"
                    >
                      <span class="ui-span">{{ t('bookmarks.remove') }}</span>
                    </button>
                    <button
                      v-else
                      type="button"
                      class="ui-button h-9 border-atlas-accent bg-atlas-accent px-3 text-xs text-white hover:bg-atlas-accentDark"
                      @click="saveSourceReference(reference)"
                    >
                      <span class="ui-span">{{ t('bookmarks.saveWorkspace') }}</span>
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <section class="atlas-panel h-fit overflow-hidden">
              <div class="border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">{{ t('bookmarks.watchlist') }}</h3>
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
                    <span class="ui-span mt-1 block text-xs text-atlas-muted">{{ t('bookmarks.prMeta', { files: pullRequest.changedFiles, checks: pullRequest.checks }) }}</span>
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
                  <h3 class="ui-title text-base">{{ t('reports.center') }}</h3>
                  <p class="mt-1 text-xs text-atlas-muted">{{ t('reports.detail') }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="ui-button h-9 border-atlas-accent bg-atlas-accent px-3 text-xs text-white shadow-instrument hover:bg-atlas-accentDark"
                    @click="exportCurrentReport('markdown')"
                  >
                    <span class="ui-span">{{ t('reports.exportMarkdown') }}</span>
                  </button>
                  <button
                    type="button"
                    class="ui-button h-9 border-atlas-border bg-white px-3 text-xs text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
                    @click="exportCurrentReport('json')"
                  >
                    <span class="ui-span">{{ t('reports.exportJson') }}</span>
                  </button>
                  <button
                    type="button"
                    class="ui-button h-9 border-atlas-border bg-white px-3 text-xs text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
                    @click="copyCurrentReport"
                  >
                    <span class="ui-span">{{ t('reports.copy') }}</span>
                  </button>
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full min-w-[620px] text-left text-sm">
                  <thead class="bg-atlas-canvas text-xs font-medium text-atlas-muted">
                    <tr>
                      <th class="border-b border-atlas-line px-4 py-2 font-medium">{{ t('reports.report') }}</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">{{ t('common.status') }}</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">{{ t('reports.scope') }}</th>
                      <th class="border-b border-atlas-line px-2 py-2 font-medium">{{ t('common.updated') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="report in reportRows" :key="report.name" class="border-b border-atlas-line last:border-0">
                      <td class="px-4 py-3 font-medium text-atlas-ink">{{ report.name }}</td>
                      <td class="px-2 py-3">
                        <span class="ui-span rounded px-2 py-1 text-xs font-semibold" :class="report.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : report.status === 'review' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-atlas-danger'">
                          {{ report.statusLabel }}
                        </span>
                      </td>
                      <td class="px-2 py-3 text-atlas-muted">{{ report.scope }}</td>
                      <td class="px-2 py-3 text-atlas-muted">{{ report.updated }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="border-t border-atlas-line bg-atlas-canvas px-4 py-3 text-xs leading-5 text-atlas-muted">
                {{ t('reports.lastExport', { time: lastReportExportedAt === 'Not exported yet' ? t('status.notExported') : lastReportExportedAt }) }}
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
            <div class="flex flex-col gap-4">
              <section class="atlas-panel overflow-hidden">
                <div class="border-b border-atlas-line px-4 py-3">
                  <h3 class="ui-title text-base">{{ t('settings.preferences') }}</h3>
                  <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ t('settings.preferencesDetail') }}</p>
                </div>
                <div class="grid gap-4 px-4 py-4 md:grid-cols-2">
                  <label class="grid gap-2">
                    <span class="ui-span text-sm font-semibold text-atlas-ink">{{ t('settings.interfaceLanguage') }}</span>
                    <select class="atlas-control h-11" :value="locale" @change="handleLocaleInput">
                      <option v-for="option in localeOptions" :key="option.code" :value="option.code">
                        {{ option.nativeLabel }} / {{ option.shortLabel }}
                      </option>
                    </select>
                  </label>
                  <label class="grid gap-2">
                    <span class="ui-span text-sm font-semibold text-atlas-ink">{{ t('settings.themeMode') }}</span>
                    <select class="atlas-control h-11" :value="themePreference" @change="handleThemeInput">
                      <option v-for="option in themeOptions" :key="option.code" :value="option.code">
                        {{ t(option.labelKey) }}
                      </option>
                    </select>
                  </label>
                </div>
                <div class="border-t border-atlas-line bg-atlas-canvas px-4 py-3">
                  <span class="ui-span text-sm font-semibold text-atlas-ink">{{ activeThemeLabel }}</span>
                  <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ t('theme.systemHint') }}</p>
                </div>
              </section>

              <section class="atlas-panel overflow-hidden">
                <div class="border-b border-atlas-line px-4 py-3">
                  <h3 class="ui-title text-base">{{ t('settings.workspace') }}</h3>
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
                      :aria-label="setting.enabled ? t('settings.disable', { label: setting.label }) : t('settings.enable', { label: setting.label })"
                      :aria-pressed="setting.enabled"
                      @click="toggleWorkspaceSetting(setting.key)"
                    >
                      <span class="ui-span h-6 w-6 rounded-full bg-white shadow-sm transition" :class="setting.enabled ? 'translate-x-6' : 'translate-x-0'"></span>
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <section class="atlas-panel h-fit overflow-hidden">
              <div class="border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">{{ t('settings.state') }}</h3>
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
