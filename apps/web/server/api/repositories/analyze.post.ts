import {
  analyzeRepositorySnapshot,
  type PackageManifest,
  type PullRequestSnapshot,
  type RepositoryAnalysis
} from '@codeatlas/analyzer'
import {
  encodeGitHubPath,
  githubRequest,
  parseRepository,
  type ParsedRepository
} from '../../utils/github'
import { enhanceRepositoryAnalysisWithGemini } from '../../utils/codeatlas-ai'

interface AnalyzeBody {
  repository?: string
}

interface GitHubRepository {
  full_name: string
  description: string | null
  default_branch: string
  html_url: string
  language: string | null
  stargazers_count: number
  forks_count: number
}

interface GitHubTreeItem {
  path: string
  type: 'blob' | 'tree' | 'commit'
  size?: number
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[]
  truncated: boolean
}

interface GitHubPullListItem {
  number: number
  title: string
  draft?: boolean
  html_url?: string
}

interface GitHubPullDetail extends GitHubPullListItem {
  changed_files?: number
}

export default defineEventHandler(async (event): Promise<RepositoryAnalysis> => {
  const body = await readBody<AnalyzeBody>(event)
  const parsed = parseRepository(body.repository)

  const repo = await githubRequest<GitHubRepository>(`/repos/${parsed.owner}/${parsed.repo}`)
  const treeResponse = await githubRequest<GitHubTreeResponse>(
    `/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`
  )

  const files = treeResponse.tree.filter((item) => item.type === 'blob')
  const [readme, packageManifests, pullRequests] = await Promise.all([
    fetchReadme(parsed),
    fetchPackageManifests(parsed, repo.default_branch, files),
    fetchPullRequests(parsed)
  ])

  const analysis = analyzeRepositorySnapshot({
    repository: {
      fullName: repo.full_name,
      description: repo.description ?? '',
      defaultBranch: repo.default_branch,
      url: repo.html_url,
      language: repo.language ?? 'Mixed',
      stars: repo.stargazers_count,
      forks: repo.forks_count
    },
    files: files.map((file) => ({
      path: file.path,
      size: file.size
    })),
    readme,
    packageManifests,
    pullRequests,
    treeTruncated: treeResponse.truncated
  })

  return await enhanceRepositoryAnalysisWithGemini(analysis)
})

async function fetchReadme(repository: ParsedRepository) {
  try {
    return await githubRequest<string>(
      `/repos/${repository.owner}/${repository.repo}/readme`,
      'application/vnd.github.raw'
    )
  } catch {
    return ''
  }
}

async function fetchPackageManifests(
  repository: ParsedRepository,
  branch: string,
  files: GitHubTreeItem[]
): Promise<PackageManifest[]> {
  const manifestPaths = files
    .map((file) => file.path)
    .filter((path) => path.endsWith('package.json'))
    .sort((a, b) => scoreImportantPath(b) - scoreImportantPath(a))
    .slice(0, 4)

  const manifests: PackageManifest[] = []

  for (const path of manifestPaths) {
    try {
      const encodedPath = encodeGitHubPath(path)
      const content = await githubRequest<string>(
        `/repos/${repository.owner}/${repository.repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
        'application/vnd.github.raw'
      )

      manifests.push({ path, content })
    } catch {
      // Manifest content is useful but non-blocking; the tree still gives enough signal.
    }
  }

  return manifests
}

async function fetchPullRequests(repository: ParsedRepository): Promise<PullRequestSnapshot[]> {
  try {
    const pulls = await githubRequest<GitHubPullListItem[]>(
      `/repos/${repository.owner}/${repository.repo}/pulls?state=open&per_page=5`
    )

    const detailedPulls: GitHubPullDetail[] = await Promise.all(
      pulls.map(async (pull) => {
        try {
          return await githubRequest<GitHubPullDetail>(
            `/repos/${repository.owner}/${repository.repo}/pulls/${pull.number}`
          )
        } catch {
          return { ...pull, changed_files: 0 }
        }
      })
    )

    return detailedPulls.map((pull) => ({
      number: pull.number,
      title: pull.title,
      changedFiles: pull.changed_files ?? 0,
      draft: pull.draft,
      url: pull.html_url
    }))
  } catch {
    return []
  }
}

function scoreImportantPath(path: string) {
  let score = 0

  if (path === 'package.json' || path.endsWith('/package.json')) {
    score += 100
  }

  if (/^apps?\//i.test(path) || /^packages?\//i.test(path)) {
    score += 35
  }

  return score - path.split('/').length
}
