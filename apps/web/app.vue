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
import type { NavSection, PullRequestReview, RepositoryAnalysis, SourceReference } from '~/types/codeatlas'

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
          <RepoAnalyzer
            v-model:repo-url="repoUrl"
            :is-analyzing="isAnalyzing"
            :last-analyzed-at="lastAnalyzedAt"
            :analysis-error="analysisError"
            @analyze="analyzeRepository"
          />

          <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
            <ArchitectureMap :nodes="architectureNodes" />
            <AiSummaryPanel :summary-items="summaryItems" :answer="answer" />
          </section>

          <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
            <SourceReferences :references="sourceReferences" />
            <PrReviewPanel
              v-model:review-url="prUrl"
              :pull-requests="pullRequests"
              :risk-signals="riskSignals"
              :review="activePullRequestReview"
              :is-reviewing="isReviewingPr"
              :review-error="prReviewError"
              @review="reviewPullRequest"
            />
          </section>

          <ObservabilityStrip :metrics="metrics" />
        </main>
      </div>
    </div>
  </div>
</template>
