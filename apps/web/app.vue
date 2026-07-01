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
import type { NavSection, PullRequest, PullRequestReview, RepositoryAnalysis, SourceReference } from '~/types/codeatlas'

interface AiQuestionResponse {
  answer: string
}

const config = useRuntimeConfig()
const activeSection = ref<NavSection>('repository')
const repoUrl = ref('github.com/nuxt/nuxt')
const prUrl = ref('github.com/nuxt/nuxt/pull/32537')
const question = ref('')
const isAnalyzing = ref(false)
const isReviewingPr = ref(false)
const analysisError = ref('')
const prReviewError = ref('')
const lastAnalyzedAt = ref('Demo data - 1,842 files - 612k LOC')
const analysis = ref<RepositoryAnalysis | null>(null)
const prReview = ref<PullRequestReview | null>(null)
const answer = ref(
  'This repository is a TypeScript-first SaaS monorepo with a Nuxt dashboard, Fastify API boundary, background workers, and shared packages for GitHub, AI prompts, and repository analysis.'
)

const architectureNodes = computed(() => analysis.value?.architectureNodes ?? demoArchitectureNodes)
const sourceReferences = computed(() => analysis.value?.sourceReferences ?? demoSourceReferences)
const pullRequests = computed(() => analysis.value?.pullRequests ?? demoPullRequests)
const summaryItems = computed(() => analysis.value?.summaryItems ?? demoSummaryItems)
const riskSignals = computed(() => analysis.value?.riskSignals ?? demoRiskSignals)
const activePullRequestReview = computed(() => prReview.value ?? demoPullRequestReview)
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
    name: 'GitHub Pages',
    status: 'Static build',
    detail: 'Public portfolio deployment with demo-safe data'
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
  { label: 'AI provider', value: isDemoMode.value ? 'Demo fallback' : 'Google Gemini' }
])

const toggleWorkspaceSetting = (key: WorkspaceSettingKey) => {
  workspaceSettings[key] = !workspaceSettings[key]
}

const openPullRequestReview = (pullRequest: PullRequest) => {
  if (pullRequest.url) {
    prUrl.value = pullRequest.url
  }

  activeSection.value = 'pr-review'
}

const analyzeRepository = async () => {
  if (!repoUrl.value.trim() || isAnalyzing.value) {
    return
  }

  isAnalyzing.value = true
  analysisError.value = ''
  lastAnalyzedAt.value = 'Analysis started now'

  try {
    const result = isDemoMode.value
      ? buildDemoRepositoryAnalysis(repoUrl.value)
      : await $fetch<RepositoryAnalysis>('/api/repositories/analyze', {
          method: 'POST',
          body: {
            repository: repoUrl.value
          }
        })

    analysis.value = result
    repoUrl.value = `github.com/${result.repository.fullName}`
    prUrl.value = result.pullRequests[0]?.url ?? prUrl.value
    prReview.value = null
    answer.value = result.answer
    lastAnalyzedAt.value = `Completed just now - ${result.repository.fileCount.toLocaleString('en-US')} files - ${formatLoc(result.repository.estimatedLoc)} LOC`
  } catch (error) {
    analysisError.value = getErrorMessage(error)
    lastAnalyzedAt.value = 'Analysis failed'
  } finally {
    isAnalyzing.value = false
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
      : await $fetch<PullRequestReview>('/api/pull-requests/review', {
          method: 'POST',
          body: {
            pullRequest: prUrl.value
          }
        })
  } catch (error) {
    prReviewError.value = getErrorMessage(error)
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
      'CodeAtlas is running in static demo mode for GitHub Pages. Deploy to a server-capable host to enable live GitHub API analysis and future LLM calls.',
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

const normalizeRepositoryFullName = (value: string) => {
  const cleaned = value.trim().replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\/$/, '')
  const [owner, repo] = cleaned.split('/')

  if (!owner || !repo) {
    return null
  }

  return `${owner}/${repo}`
}

const parsePullRequestUrl = (value: string) => {
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

  if (!normalizedQuestion) {
    return
  }

  const matches = findRelevantReferences(normalizedQuestion, sourceReferences.value)
  const files = matches.map((reference) => reference.file).join(', ')
  const repoName = analysis.value?.repository.fullName ?? 'the demo repository'
  const fallbackAnswer = `For "${normalizedQuestion}", start in ${files}. CodeAtlas selected these files from ${repoName} because their path, service, or description best matched the question.`

  if (isDemoMode.value) {
    answer.value = fallbackAnswer

    return
  }

  answer.value = 'Asking Gemini with the current CodeAtlas source references...'

  try {
    const result = await $fetch<AiQuestionResponse>('/api/ai/question', {
      method: 'POST',
      body: {
        question: normalizedQuestion,
        repositoryFullName: repoName,
        references: sourceReferences.value,
        risks: riskSignals.value
      }
    })

    answer.value = result.answer || fallbackAnswer
  } catch {
    answer.value = fallbackAnswer
  }
}

const findRelevantReferences = (query: string, references: SourceReference[]) => {
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

const formatLoc = (loc: number) => {
  if (loc >= 1_000_000) {
    return `${(loc / 1_000_000).toFixed(1)}M`
  }

  if (loc >= 1_000) {
    return `${Math.round(loc / 100) / 10}k`
  }

  return loc.toString()
}

const getErrorMessage = (error: unknown) => {
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
</script>

<template>
  <div class="min-h-screen bg-atlas-canvas text-atlas-ink">
    <div class="flex min-h-screen flex-col lg:flex-row">
      <AppSidebar
        :active-section="activeSection"
        :nav-items="navItems"
        @change-section="activeSection = $event"
      />

      <div class="min-w-0 flex-1">
        <CommandBar v-model:question="question" @ask="askCodeAtlas" />

        <main class="mx-auto flex max-w-[1540px] flex-col gap-4 px-4 py-5 md:px-6">
          <section class="flex flex-col gap-3 border-b border-atlas-line pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="atlas-muted-label">{{ currentSection.label }}</p>
              <h2 class="ui-title mt-1 text-2xl">{{ currentSection.label }}</h2>
            </div>
            <span class="ui-span inline-flex w-fit items-center rounded-atlas border border-atlas-border bg-white px-3 py-2 text-sm font-medium text-atlas-muted shadow-sm">
              {{ sectionMeta }}
            </span>
          </section>

          <section v-if="activeSection === 'repository'" class="flex flex-col gap-4">
            <RepoAnalyzer
              v-model:repo-url="repoUrl"
              :is-analyzing="isAnalyzing"
              :last-analyzed-at="lastAnalyzedAt"
              :analysis-error="analysisError"
              @analyze="analyzeRepository"
              @view-report="activeSection = 'reports'"
            />

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
              <SourceReferences :references="sourceReferences" />
              <AiSummaryPanel :summary-items="summaryItems" :answer="answer" />
            </section>
          </section>

          <section v-else-if="activeSection === 'architecture'" class="flex flex-col gap-4">
            <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
              <ArchitectureMap :nodes="architectureNodes" />
              <AiSummaryPanel :summary-items="summaryItems" :answer="answer" />
            </section>
            <SourceReferences :references="sourceReferences" />
          </section>

          <section v-else-if="activeSection === 'ask'" class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
            <section class="atlas-panel overflow-hidden">
              <div class="border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">Question workspace</h3>
              </div>
              <form class="flex flex-col gap-3 px-4 py-4 md:flex-row" @submit.prevent="askCodeAtlas">
                <label class="sr-only" for="codeatlas-question">Ask CodeAtlas</label>
                <input
                  id="codeatlas-question"
                  v-model="question"
                  class="atlas-control min-w-0 flex-1"
                  type="search"
                  placeholder="Where is billing handled?"
                >
                <button type="submit" class="ui-button h-10 bg-atlas-ink px-4 text-white hover:bg-atlas-accent">
                  <span class="ui-span">Ask Gemini</span>
                </button>
              </form>
              <div class="border-t border-atlas-line px-4 py-4">
                <p class="text-sm leading-6 text-atlas-ink">{{ answer }}</p>
              </div>
            </section>
            <section class="flex flex-col gap-4">
              <AiSummaryPanel :summary-items="summaryItems" :answer="answer" />
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
              <div class="border-b border-atlas-line px-4 py-3">
                <h3 class="ui-title text-base">Report center</h3>
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
            </section>

            <AiSummaryPanel :summary-items="summaryItems" :answer="answer" />
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
        </main>
      </div>
    </div>
  </div>
</template>
