import {
  analyzePullRequestSnapshot,
  type PullRequestFileSnapshot,
  type PullRequestReview
} from '@codeatlas/analyzer'
import { githubRequest, parsePullRequest } from '../../utils/github'

interface ReviewBody {
  pullRequest?: string
}

interface GitHubPullDetail {
  number: number
  title: string
  body: string | null
  state: string
  draft?: boolean
  html_url: string
  changed_files?: number
  additions?: number
  deletions?: number
  user?: {
    login?: string
  }
  base: {
    ref: string
    repo: {
      full_name: string
    }
  }
  head: {
    ref: string
  }
}

interface GitHubPullFile {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch?: string
}

export default defineEventHandler(async (event): Promise<PullRequestReview> => {
  const body = await readBody<ReviewBody>(event)
  const parsed = parsePullRequest(body.pullRequest)

  const [pullRequest, files] = await Promise.all([
    githubRequest<GitHubPullDetail>(`/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`),
    fetchPullRequestFiles(parsed.owner, parsed.repo, parsed.number)
  ])

  return analyzePullRequestSnapshot({
    repositoryFullName: pullRequest.base.repo.full_name,
    pullRequest: {
      number: pullRequest.number,
      title: pullRequest.title,
      body: pullRequest.body ?? '',
      state: pullRequest.state,
      draft: Boolean(pullRequest.draft),
      author: pullRequest.user?.login ?? 'unknown',
      url: pullRequest.html_url,
      baseBranch: pullRequest.base.ref,
      headBranch: pullRequest.head.ref,
      changedFiles: pullRequest.changed_files ?? files.length,
      additions: pullRequest.additions ?? sum(files, 'additions'),
      deletions: pullRequest.deletions ?? sum(files, 'deletions')
    },
    files
  })
})

async function fetchPullRequestFiles(owner: string, repo: string, number: number): Promise<PullRequestFileSnapshot[]> {
  const files = await githubRequest<GitHubPullFile[]>(
    `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`
  )

  return files.map((file) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch
  }))
}

function sum(files: GitHubPullFile[], key: 'additions' | 'deletions') {
  return files.reduce((total, file) => total + file[key], 0)
}
