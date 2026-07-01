interface GeminiContentBlock {
  text?: string
  type?: string
}

interface GeminiStep {
  content?: GeminiContentBlock[]
  type?: string
}

interface GeminiInteractionResponse {
  steps?: GeminiStep[]
}

interface GeminiTextOptions {
  temperature?: number
}

export function isGeminiConfigured() {
  return Boolean(readGeminiApiKey())
}

export async function generateGeminiText(input: string, options: GeminiTextOptions = {}) {
  const apiKey = readGeminiApiKey()

  if (!apiKey) {
    return null
  }

  const model = readGeminiModel()
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      model,
      input,
      generation_config: {
        thinking_level: 'low',
        temperature: options.temperature ?? 0.2
      }
    })
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')

    throw createError({
      statusCode: response.status,
      statusMessage: `Gemini API request failed with ${response.status}.${details ? ` ${details.slice(0, 160)}` : ''}`
    })
  }

  const data = (await response.json()) as GeminiInteractionResponse
  const text = extractInteractionText(data)

  return text || null
}

function extractInteractionText(data: GeminiInteractionResponse) {
  return (data.steps ?? [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .map((block) => block.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim()
}

function readGeminiApiKey() {
  const config = useRuntimeConfig()
  const configured = typeof config.geminiApiKey === 'string' ? config.geminiApiKey : ''

  return configured || readProcessEnv('GEMINI_API_KEY') || ''
}

function readGeminiModel() {
  const config = useRuntimeConfig()
  const configured = typeof config.geminiModel === 'string' ? config.geminiModel : ''

  return configured || readProcessEnv('GEMINI_MODEL') || 'gemini-3.5-flash'
}

function readProcessEnv(name: string) {
  const runtime = globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>
    }
  }

  return runtime.process?.env?.[name]
}
