import type { SourceReference } from '@codeatlas/analyzer'
import { answerQuestionWithGemini } from '../../utils/codeatlas-ai'

interface QuestionBody {
  question?: string
  repositoryFullName?: string
  references?: SourceReference[]
  risks?: string[]
}

export default defineEventHandler(async (event) => {
  const body = await readBody<QuestionBody>(event)
  const question = body.question?.trim()

  if (!question) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ask a repository question first.'
    })
  }

  const answer = await answerQuestionWithGemini({
    question,
    repositoryFullName: body.repositoryFullName?.trim() || 'the current repository',
    references: sanitizeReferences(body.references),
    risks: Array.isArray(body.risks) ? body.risks.filter(Boolean).slice(0, 8) : []
  })

  if (!answer) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Gemini is not configured or did not return an answer.'
    })
  }

  return { answer }
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
      description: String(reference.description ?? '')
    }))
    .filter((reference) => reference.file)
    .slice(0, 20)
}
