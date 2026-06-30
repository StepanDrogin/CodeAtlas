import { readFileSync } from 'node:fs'

const apiUrl = process.env.INPUT_CODEATLAS_API_URL
const explicitPrUrl = process.env.INPUT_PR_URL
const eventPath = process.env.GITHUB_EVENT_PATH
const repository = process.env.GITHUB_REPOSITORY
const summaryPath = process.env.GITHUB_STEP_SUMMARY

const prUrl = explicitPrUrl || readPullRequestUrl(eventPath, repository)

if (!prUrl) {
  await writeSummary('CodeAtlas PR Review\n\nNo pull request URL was available for this workflow event.')
  process.exit(0)
}

if (!apiUrl) {
  await writeSummary(`CodeAtlas PR Review\n\nDry run only. Configure codeatlas-api-url to review ${prUrl}.`)
  process.exit(0)
}

const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/pull-requests/review`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pullRequest: prUrl
  })
})

if (!response.ok) {
  throw new Error(`CodeAtlas API request failed with ${response.status}`)
}

const review = await response.json()
const lines = [
  'CodeAtlas PR Review',
  '',
  `Risk: ${review.risk}`,
  `Summary: ${review.summary}`,
  '',
  'Affected modules:',
  ...review.affectedModules.map((module) => `- ${module.name}: ${module.risk}, ${module.reason}`),
  '',
  'Suggested comments:',
  ...review.suggestedComments.map((comment) => `- ${comment.severity} ${comment.file}: ${comment.message}`)
]

await writeSummary(lines.join('\n'))

function readPullRequestUrl(path, repo) {
  if (!path || !repo) {
    return ''
  }

  try {
    const event = JSON.parse(readFileSync(path, 'utf8'))
    const number = event.pull_request?.number

    return number ? `https://github.com/${repo}/pull/${number}` : ''
  } catch {
    return ''
  }
}

async function writeSummary(markdown) {
  if (summaryPath) {
    const { appendFile } = await import('node:fs/promises')
    await appendFile(summaryPath, `${markdown}\n`)
    return
  }

  console.log(markdown)
}
