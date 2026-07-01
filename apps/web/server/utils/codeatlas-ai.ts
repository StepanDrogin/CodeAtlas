import type {
  PullRequestFileSnapshot,
  PullRequestReview,
  RepositoryAnalysis,
  ReviewCommentSuggestion,
  SummaryItem
} from '@codeatlas/analyzer'
import { generateGeminiText, isGeminiConfigured } from './gemini'

interface RepositoryAiResponse {
  answer?: string
  summaryItems?: SummaryItem[]
}

interface PullRequestAiResponse {
  summary?: string
  suggestedComments?: ReviewCommentSuggestion[]
}

interface QuestionAiInput {
  question: string
  repositoryFullName: string
  references: Array<{
    file: string
    type: string
    service: string
    description: string
  }>
  risks: string[]
}

export async function enhanceRepositoryAnalysisWithGemini(analysis: RepositoryAnalysis) {
  if (!isGeminiConfigured()) {
    return analysis
  }

  try {
    const text = await generateGeminiText(buildRepositoryPrompt(analysis), { temperature: 0.15 })
    const parsed = parseJsonObject<RepositoryAiResponse>(text)

    return {
      ...analysis,
      answer: normalizeText(parsed?.answer) ?? analysis.answer,
      summaryItems: sanitizeSummaryItems(parsed?.summaryItems) ?? analysis.summaryItems
    }
  } catch {
    return analysis
  }
}

export async function enhancePullRequestReviewWithGemini(
  review: PullRequestReview,
  files: PullRequestFileSnapshot[]
) {
  if (!isGeminiConfigured()) {
    return review
  }

  try {
    const text = await generateGeminiText(buildPullRequestPrompt(review, files), { temperature: 0.1 })
    const parsed = parseJsonObject<PullRequestAiResponse>(text)

    return {
      ...review,
      summary: normalizeText(parsed?.summary) ?? review.summary,
      suggestedComments: sanitizeSuggestedComments(parsed?.suggestedComments) ?? review.suggestedComments
    }
  } catch {
    return review
  }
}

export async function answerQuestionWithGemini(input: QuestionAiInput) {
  if (!isGeminiConfigured()) {
    return null
  }

  try {
    return normalizeText(await generateGeminiText(buildQuestionPrompt(input), { temperature: 0.2 }))
  } catch {
    return null
  }
}

function buildRepositoryPrompt(analysis: RepositoryAnalysis) {
  return `You are CodeAtlas, a senior codebase onboarding assistant.
Use only the repository analysis JSON below. Do not invent file paths, dependencies, or services.
Return strict JSON only, without markdown fences, with this shape:
{
  "answer": "2-4 concise sentences for the dashboard summary",
  "summaryItems": [
    {"label":"Purpose","text":"...","tone":"neutral"},
    {"label":"Architecture","text":"...","tone":"neutral"},
    {"label":"Strengths","text":"...","tone":"good"},
    {"label":"Risks","text":"...","tone":"risk"},
    {"label":"Opportunities","text":"...","tone":"opportunity"}
  ]
}

Repository analysis:
${JSON.stringify(
  {
    repository: analysis.repository,
    technologies: analysis.technologies,
    architectureNodes: analysis.architectureNodes,
    sourceReferences: analysis.sourceReferences.slice(0, 10),
    riskSignals: analysis.riskSignals,
    pullRequests: analysis.pullRequests.slice(0, 5)
  },
  null,
  2
)}`
}

function buildPullRequestPrompt(review: PullRequestReview, files: PullRequestFileSnapshot[]) {
  return `You are CodeAtlas, a pragmatic senior pull request reviewer.
Use only the PR metadata and changed-file list below. Do not claim you reviewed full file contents.
Return strict JSON only, without markdown fences, with this shape:
{
  "summary": "2-3 concise sentences explaining risk, blast radius, and what to verify",
  "suggestedComments": [
    {"file":"path/from/input","severity":"Low|Medium|High","message":"review comment","rationale":"why this deserves attention"}
  ]
}
Keep suggestedComments to at most 4 items.

PR review:
${JSON.stringify(review, null, 2)}

Changed files:
${JSON.stringify(
  files.slice(0, 40).map((file) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patchPreview: file.patch?.slice(0, 1200)
  })),
  null,
  2
)}`
}

function buildQuestionPrompt(input: QuestionAiInput) {
  return `You are CodeAtlas answering a developer's question about a repository.
Use only the provided source references and risk signals. If the exact answer is not present, say which files to inspect next.
Keep the answer concise and cite file paths from the provided references.

Repository: ${input.repositoryFullName}
Question: ${input.question}
Risk signals:
${input.risks.map((risk) => `- ${risk}`).join('\n') || '- none'}
Source references:
${input.references
  .slice(0, 12)
  .map((reference) => `- ${reference.file} [${reference.type}] ${reference.service}: ${reference.description}`)
  .join('\n')}`
}

function parseJsonObject<T>(text?: string | null) {
  if (!text) {
    return null
  }

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    return null
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

function normalizeText(value?: string | null) {
  const normalized = value?.trim()

  return normalized || null
}

function sanitizeSummaryItems(items?: SummaryItem[]) {
  if (!Array.isArray(items)) {
    return null
  }

  const allowedTones = new Set<SummaryItem['tone']>(['neutral', 'good', 'risk', 'opportunity'])
  const sanitized = items
    .map((item) => ({
      label: normalizeText(item.label) ?? '',
      text: normalizeText(item.text) ?? '',
      tone: allowedTones.has(item.tone) ? item.tone : 'neutral'
    }))
    .filter((item) => item.label && item.text)
    .slice(0, 5)

  return sanitized.length ? sanitized : null
}

function sanitizeSuggestedComments(comments?: ReviewCommentSuggestion[]) {
  if (!Array.isArray(comments)) {
    return null
  }

  const allowedSeverities = new Set<ReviewCommentSuggestion['severity']>(['Low', 'Medium', 'High'])
  const sanitized = comments
    .map((comment) => ({
      file: normalizeText(comment.file) ?? '',
      severity: allowedSeverities.has(comment.severity) ? comment.severity : 'Medium',
      message: normalizeText(comment.message) ?? '',
      rationale: normalizeText(comment.rationale) ?? ''
    }))
    .filter((comment) => comment.file && comment.message && comment.rationale)
    .slice(0, 4)

  return sanitized.length ? sanitized : null
}
