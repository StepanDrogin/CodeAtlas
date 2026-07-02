import type { SourceReference } from '@codeatlas/analyzer'
import { answerQuestionWithGemini } from '../../utils/codeatlas-ai'

interface QuestionBody {
  question?: string
  repositoryFullName?: string
  references?: SourceReference[]
  risks?: string[]
}

interface QuestionResponse {
  answer: string
  references: SourceReference[]
  confidence: number
}

export default defineEventHandler(async (event): Promise<QuestionResponse> => {
  const body = await readBody<QuestionBody>(event)
  const question = body.question?.trim()

  if (!question) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ask a repository question first.'
    })
  }

  const references = sanitizeReferences(body.references)
  const evidenceReferences = selectQuestionReferences(question, references)
  const risks = Array.isArray(body.risks) ? body.risks.filter(Boolean).slice(0, 8) : []
  const answer = await answerQuestionWithGemini({
    question,
    repositoryFullName: body.repositoryFullName?.trim() || 'the current repository',
    references: evidenceReferences,
    risks
  })

  if (!answer) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Gemini is not configured or did not return an answer.'
    })
  }

  return {
    answer,
    references: evidenceReferences,
    confidence: estimateQuestionConfidence(question, evidenceReferences, risks)
  }
})

function sanitizeReferences(references?: SourceReference[]) {
  if (!Array.isArray(references)) {
    return []
  }

  return references
    .map((reference) => ({
      file: String(reference.file ?? ''),
      type: String(reference.type ?? ''),
      service: String(reference.service ?? ''),
      description: String(reference.description ?? ''),
      loc: Number(reference.loc ?? 0),
      updated: String(reference.updated ?? 'Indexed now')
    }))
    .filter((reference) => reference.file)
    .slice(0, 20)
}

function selectQuestionReferences(question: string, references: SourceReference[]) {
  const tokens = question
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 2)

  const scored = references
    .map((reference) => {
      const haystack = `${reference.file} ${reference.type} ${reference.service} ${reference.description}`.toLowerCase()
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0)

      return { reference, score }
    })
    .sort((a, b) => b.score - a.score || b.reference.loc - a.reference.loc)

  const matched = scored.filter((item) => item.score > 0).slice(0, 5).map((item) => item.reference)

  return matched.length ? matched : references.slice(0, 5)
}

function estimateQuestionConfidence(question: string, references: SourceReference[], risks: string[]) {
  const questionWeight = Math.min(question.length, 120) / 120
  const referenceWeight = Math.min(references.length, 5) / 5
  const riskPenalty = Math.min(risks.length * 4, 20)

  return Math.max(44, Math.min(Math.round(48 + questionWeight * 18 + referenceWeight * 28 - riskPenalty), 96))
}
