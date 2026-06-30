export interface ParsedRepository {
  owner: string
  repo: string
}

export interface ParsedPullRequest extends ParsedRepository {
  number: number
}

export function parseRepository(input?: string): ParsedRepository {
  const raw = input?.trim()

  if (!raw) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Enter a GitHub repository URL or owner/repo.'
    })
  }

  const normalized = normalizeGitHubInput(raw)
  const segments = normalized.split('/')
  const [owner, repoWithSuffix] = segments
  const repo = repoWithSuffix?.replace(/\.git$/, '')

  if (!owner || !repo || segments.length < 2 || !isGitHubPathSegment(owner) || !isGitHubPathSegment(repo)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use a public GitHub repository like github.com/nuxt/nuxt.'
    })
  }

  return { owner, repo }
}

export function parsePullRequest(input?: string): ParsedPullRequest {
  const raw = input?.trim()

  if (!raw) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Enter a GitHub pull request URL.'
    })
  }

  const normalized = normalizeGitHubInput(raw).replace(/\/$/, '')
  const hashMatch = normalized.match(/^([^/]+)\/([^/#]+)#(\d+)$/)
  const pathMatch = normalized.match(/^([^/]+)\/([^/]+)\/pulls?\/(\d+)$/)
  const match = pathMatch ?? hashMatch

  if (!match) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use a public GitHub pull request like github.com/owner/repo/pull/123.'
    })
  }

  const [, owner, repoWithSuffix, numberText] = match
  const repo = repoWithSuffix.replace(/\.git$/, '')
  const number = Number(numberText)

  if (!isGitHubPathSegment(owner) || !isGitHubPathSegment(repo) || !Number.isInteger(number) || number < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use a valid GitHub pull request URL.'
    })
  }

  return { owner, repo, number }
}

export async function githubRequest<T>(path: string, accept = 'application/vnd.github+json'): Promise<T> {
  const token = useRuntimeConfig().githubToken
  const headers: Record<string, string> = {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'CodeAtlas'
  }

  if (typeof token === 'string' && token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`https://api.github.com${path}`, { headers })

  if (response.status === 404) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Requested GitHub resource was not found or is unavailable.'
    })
  }

  if (!response.ok) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining')
    const message =
      rateLimitRemaining === '0'
        ? 'GitHub API rate limit exceeded. Set NUXT_GITHUB_TOKEN locally for a higher limit.'
        : `GitHub API request failed with ${response.status}.`

    throw createError({
      statusCode: response.status,
      statusMessage: message
    })
  }

  if (accept.includes('raw')) {
    return (await response.text()) as T
  }

  return (await response.json()) as T
}

export function encodeGitHubPath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}

function normalizeGitHubInput(raw: string) {
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/^github\.com\//, '')
    .replace(/[#?].*$/, (suffix) => (suffix.startsWith('#') && /^#\d+$/.test(suffix) ? suffix : ''))
    .replace(/\/$/, '')
}

function isGitHubPathSegment(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value)
}
