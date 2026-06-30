export type RiskLevel = 'High' | 'Medium' | 'Low'

export interface ArchitectureNode {
  id: string
  label: string
  detail: string
  kind: 'api' | 'service' | 'worker' | 'data' | 'external'
  column: 'entry' | 'backend' | 'workers' | 'data'
}

export interface SourceReference {
  file: string
  type: string
  service: string
  description: string
  loc: number
  updated: string
}

export interface PullRequest {
  id: string
  title: string
  changedFiles: number
  risk: RiskLevel
  checks: string
  url?: string
  affectedModules?: string[]
}

export interface SummaryItem {
  label: string
  text: string
  tone: 'neutral' | 'good' | 'risk' | 'opportunity'
}

export interface RepositoryMeta {
  fullName: string
  description: string
  defaultBranch: string
  url: string
  language: string
  stars: number
  forks: number
  fileCount: number
  estimatedLoc: number
  truncated: boolean
}

export interface RepositoryAnalysis {
  repository: RepositoryMeta
  architectureNodes: ArchitectureNode[]
  sourceReferences: SourceReference[]
  pullRequests: PullRequest[]
  summaryItems: SummaryItem[]
  riskSignals: string[]
  technologies: string[]
  answer: string
  analyzedAt: string
}

export interface RepositorySnapshot {
  fullName: string
  description: string
  defaultBranch: string
  url: string
  language: string
  stars: number
  forks: number
}

export interface RepositoryFile {
  path: string
  size?: number
}

export interface PackageManifest {
  path: string
  content: string
}

export interface PullRequestSnapshot {
  number: number
  title: string
  changedFiles: number
  draft?: boolean
  url?: string
}

export interface PullRequestFileSnapshot {
  filename: string
  status: string
  additions: number
  deletions: number
  changes: number
  patch?: string
}

export interface PullRequestDetailSnapshot {
  number: number
  title: string
  body: string
  state: string
  draft: boolean
  author: string
  url: string
  baseBranch: string
  headBranch: string
  changedFiles: number
  additions: number
  deletions: number
}

export interface PullRequestReviewInput {
  repositoryFullName: string
  pullRequest: PullRequestDetailSnapshot
  files: PullRequestFileSnapshot[]
  analyzedAt?: Date
}

export interface PullRequestModuleImpact {
  name: string
  files: number
  risk: RiskLevel
  reason: string
}

export interface ReviewCommentSuggestion {
  file: string
  severity: RiskLevel
  message: string
  rationale: string
}

export interface PullRequestReview {
  id: string
  repositoryFullName: string
  title: string
  url: string
  author: string
  state: string
  risk: RiskLevel
  changedFiles: number
  additions: number
  deletions: number
  summary: string
  affectedModules: PullRequestModuleImpact[]
  missingTests: string[]
  securityConcerns: string[]
  breakingChanges: string[]
  suggestedComments: ReviewCommentSuggestion[]
  checklist: string[]
  analyzedAt: string
}

export interface AnalyzeRepositorySnapshotInput {
  repository: RepositorySnapshot
  files: RepositoryFile[]
  readme: string
  packageManifests: PackageManifest[]
  pullRequests: PullRequestSnapshot[]
  treeTruncated: boolean
  analyzedAt?: Date
}

const SOURCE_EXTENSIONS = new Map<string, string>([
  ['.ts', 'TS'],
  ['.tsx', 'TSX'],
  ['.js', 'JS'],
  ['.jsx', 'JSX'],
  ['.vue', 'VUE'],
  ['.py', 'PY'],
  ['.go', 'GO'],
  ['.rs', 'RS'],
  ['.java', 'JAVA'],
  ['.kt', 'KT'],
  ['.cs', 'CS'],
  ['.php', 'PHP'],
  ['.rb', 'RB'],
  ['.swift', 'SWIFT'],
  ['.md', 'MD'],
  ['.json', 'JSON'],
  ['.toml', 'TOML'],
  ['.yml', 'YML'],
  ['.yaml', 'YAML']
])

const IMPORTANT_FILES = [
  'README.md',
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'nuxt.config.ts',
  'next.config.ts',
  'vite.config.ts',
  'tsconfig.json',
  'tailwind.config.ts',
  'pyproject.toml',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'Dockerfile',
  'docker-compose.yml'
]

export function analyzeRepositorySnapshot(input: AnalyzeRepositorySnapshotInput): RepositoryAnalysis {
  const technologies = detectTechnologies(input.files, input.packageManifests, input.repository.language)
  const sourceReferences = buildSourceReferences(input.files)
  const riskSignals = buildRiskSignals(input.files, input.treeTruncated, input.readme, input.packageManifests)
  const architectureNodes = buildArchitectureNodes(input.repository.fullName, technologies, input.files)
  const summaryItems = buildSummaryItems(input.repository, technologies, input.files, input.readme, riskSignals)
  const estimatedLoc = estimateLoc(input.files)
  const pullRequests = input.pullRequests.map((pullRequest) => {
    const risk = scorePullRequestRisk(pullRequest.changedFiles, pullRequest.title)

    return {
      id: `#${pullRequest.number}`,
      title: pullRequest.title,
      changedFiles: pullRequest.changedFiles,
      risk,
      checks: pullRequest.draft ? 'Draft' : 'Open',
      url: pullRequest.url
    }
  })

  return {
    repository: {
      fullName: input.repository.fullName,
      description: input.repository.description,
      defaultBranch: input.repository.defaultBranch,
      url: input.repository.url,
      language: input.repository.language || 'Mixed',
      stars: input.repository.stars,
      forks: input.repository.forks,
      fileCount: input.files.length,
      estimatedLoc,
      truncated: input.treeTruncated
    },
    architectureNodes,
    sourceReferences,
    pullRequests,
    summaryItems,
    riskSignals,
    technologies,
    answer: buildAnswer(input.repository.fullName, technologies, sourceReferences, riskSignals),
    analyzedAt: (input.analyzedAt ?? new Date()).toISOString()
  }
}

export function detectTechnologies(
  files: RepositoryFile[],
  packageManifests: PackageManifest[],
  primaryLanguage: string
) {
  const paths = files.map((file) => file.path)
  const techs = new Set<string>()

  if (primaryLanguage) {
    techs.add(primaryLanguage)
  }

  addIf(paths.some((path) => path.endsWith('tsconfig.json') || path.endsWith('.ts') || path.endsWith('.tsx')), 'TypeScript', techs)
  addIf(paths.some((path) => path.endsWith('package.json')), 'Node.js', techs)
  addIf(paths.some((path) => path.includes('nuxt.config')), 'Nuxt', techs)
  addIf(paths.some((path) => path.includes('next.config')), 'Next.js', techs)
  addIf(paths.some((path) => path.includes('vite.config')), 'Vite', techs)
  addIf(paths.some((path) => path.includes('tailwind.config')), 'Tailwind CSS', techs)
  addIf(paths.some((path) => path.endsWith('.vue')), 'Vue', techs)
  addIf(paths.some((path) => path.endsWith('.py') || path.endsWith('pyproject.toml')), 'Python', techs)
  addIf(paths.some((path) => path.endsWith('go.mod') || path.endsWith('.go')), 'Go', techs)
  addIf(paths.some((path) => path.endsWith('Cargo.toml') || path.endsWith('.rs')), 'Rust', techs)
  addIf(paths.some((path) => path.endsWith('Dockerfile') || path.includes('docker-compose')), 'Docker', techs)
  addIf(paths.some((path) => path.startsWith('.github/workflows/')), 'GitHub Actions', techs)
  addIf(paths.some((path) => path.includes('prisma/schema.prisma')), 'Prisma', techs)

  for (const manifest of packageManifests) {
    try {
      const json = JSON.parse(manifest.content) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      const deps = { ...json.dependencies, ...json.devDependencies }

      addIf(Boolean(deps.nuxt), 'Nuxt', techs)
      addIf(Boolean(deps.vue), 'Vue', techs)
      addIf(Boolean(deps.react), 'React', techs)
      addIf(Boolean(deps.next), 'Next.js', techs)
      addIf(Boolean(deps.fastify), 'Fastify', techs)
      addIf(Boolean(deps.express), 'Express', techs)
      addIf(Boolean(deps['@nestjs/core']), 'NestJS', techs)
      addIf(Boolean(deps.prisma || deps['@prisma/client']), 'Prisma', techs)
      addIf(Boolean(deps.tailwindcss), 'Tailwind CSS', techs)
      addIf(Boolean(deps.vitest), 'Vitest', techs)
      addIf(Boolean(deps.playwright || deps['@playwright/test']), 'Playwright', techs)
    } catch {
      // Invalid package.json should not block repository analysis.
    }
  }

  return Array.from(techs).slice(0, 10)
}

export function buildArchitectureNodes(fullName: string, technologies: string[], files: RepositoryFile[]): ArchitectureNode[] {
  const paths = files.map((file) => file.path)
  const nodes: ArchitectureNode[] = [
    {
      id: 'repo',
      label: 'Repository',
      detail: fullName,
      kind: 'api',
      column: 'entry'
    }
  ]

  if (hasFrontend(technologies, paths)) {
    nodes.push({
      id: 'frontend',
      label: 'Frontend',
      detail: firstMatchingTechnology(technologies, ['Nuxt', 'Next.js', 'Vue', 'React', 'Vite']) ?? 'UI layer',
      kind: 'service',
      column: 'backend'
    })
  }

  nodes.push({
    id: 'code',
    label: 'Source Modules',
    detail: `${files.length.toLocaleString('en-US')} files`,
    kind: 'service',
    column: 'backend'
  })

  if (paths.some((path) => /(^|\/)(api|server|routes|controllers)\//i.test(path))) {
    nodes.push({
      id: 'api',
      label: 'API Layer',
      detail: 'Server routes',
      kind: 'service',
      column: 'backend'
    })
  }

  if (paths.some((path) => /(^|\/)(worker|workers|jobs|queues?)\//i.test(path))) {
    nodes.push({
      id: 'workers',
      label: 'Workers',
      detail: 'Background jobs',
      kind: 'worker',
      column: 'workers'
    })
  }

  if (paths.some((path) => path.startsWith('.github/workflows/'))) {
    nodes.push({
      id: 'ci',
      label: 'CI Workflows',
      detail: 'GitHub Actions',
      kind: 'worker',
      column: 'workers'
    })
  }

  nodes.push({
    id: 'manifests',
    label: 'Manifests',
    detail: technologies.slice(0, 3).join(', ') || 'Project config',
    kind: 'data',
    column: 'data'
  })

  nodes.push({
    id: 'github',
    label: 'GitHub API',
    detail: 'Repo tree and PRs',
    kind: 'external',
    column: 'data'
  })

  return nodes.slice(0, 10)
}

export function buildSourceReferences(files: RepositoryFile[]): SourceReference[] {
  return files
    .filter((file) => isReferenceCandidate(file.path))
    .sort((a, b) => scoreImportantPath(b.path) - scoreImportantPath(a.path))
    .slice(0, 8)
    .map((file) => ({
      file: file.path,
      type: fileType(file.path),
      service: classifyService(file.path),
      description: describeFile(file.path),
      loc: estimateFileLoc(file.size),
      updated: 'Indexed now'
    }))
}

export function buildRiskSignals(
  files: RepositoryFile[],
  truncated: boolean,
  readme: string,
  packageManifests: PackageManifest[]
) {
  const paths = files.map((file) => file.path)
  const risks: string[] = []

  if (truncated) {
    risks.push('GitHub returned a truncated tree; large repository analysis needs paginated clone-based ingestion.')
  }

  if (!readme) {
    risks.push('README was not found, so onboarding documentation may be weak.')
  }

  if (paths.some((path) => isSensitivePath(path))) {
    risks.push('Credential-like or environment files were detected in the repository tree; verify secrets are not committed.')
  }

  if (!paths.some((path) => /(^|\/)(test|tests|__tests__|spec)\//i.test(path) || /\.(test|spec)\./i.test(path))) {
    risks.push('No obvious test files were detected in the repository tree.')
  }

  if (!paths.some((path) => path.startsWith('.github/workflows/'))) {
    risks.push('No GitHub Actions workflows were detected for CI visibility.')
  }

  if (packageManifests.length > 1) {
    risks.push(`Multiple package.json files detected (${packageManifests.length}); monorepo boundaries should be documented.`)
  }

  if (packageManifests.length && !paths.some((path) => /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(path))) {
    risks.push('Node manifests exist but no common lockfile was detected.')
  }

  if (packageManifests.some(hasInstallLifecycleScript)) {
    risks.push('A package manifest contains install lifecycle scripts; review supply-chain safety before running installs.')
  }

  return risks.slice(0, 5)
}

function hasInstallLifecycleScript(manifest: PackageManifest) {
  try {
    const json = JSON.parse(manifest.content) as {
      scripts?: Record<string, string>
    }

    return Boolean(json.scripts?.preinstall || json.scripts?.install || json.scripts?.postinstall)
  } catch {
    return false
  }
}

function buildSummaryItems(
  repo: RepositorySnapshot,
  technologies: string[],
  files: RepositoryFile[],
  readme: string,
  riskSignals: string[]
): SummaryItem[] {
  const directories = new Set(
    files
      .map((file) => file.path.split('/')[0])
      .filter((segment) => segment && !segment.includes('.'))
  )

  return [
    {
      label: 'Purpose',
      text: repo.description || firstReadmeSentence(readme) || 'Public GitHub repository ready for deeper CodeAtlas analysis.',
      tone: 'neutral'
    },
    {
      label: 'Architecture',
      text: `Detected ${technologies.slice(0, 5).join(', ') || 'mixed stack'} across ${directories.size || 1} top-level areas.`,
      tone: 'neutral'
    },
    {
      label: 'Strengths',
      text: buildStrengthText(files, technologies),
      tone: 'good'
    },
    {
      label: 'Risks',
      text: riskSignals[0] ?? 'No blocking repository hygiene risks detected in the first pass.',
      tone: riskSignals.length ? 'risk' : 'good'
    },
    {
      label: 'Opportunities',
      text: 'Use embeddings and file-level analysis next to connect Q&A answers to exact source lines.',
      tone: 'opportunity'
    }
  ]
}

function buildAnswer(
  fullName: string,
  technologies: string[],
  references: SourceReference[],
  riskSignals: string[]
) {
  const referenceText = references.slice(0, 3).map((reference) => reference.file).join(', ')
  const techText = technologies.slice(0, 5).join(', ') || 'mixed stack'
  const riskText = riskSignals[0] ? ` Main risk: ${riskSignals[0]}` : ''

  return `CodeAtlas indexed ${fullName} from GitHub and detected ${techText}. Start with ${referenceText || 'the repository root'} for the first review pass.${riskText}`
}

export function scorePullRequestRisk(changedFiles: number, title: string): RiskLevel {
  if (changedFiles >= 20 || /auth|security|billing|payment|migration|token|secret/i.test(title)) {
    return 'High'
  }

  if (changedFiles >= 8 || /refactor|upgrade|cache|api/i.test(title)) {
    return 'Medium'
  }

  return 'Low'
}

export function analyzePullRequestSnapshot(input: PullRequestReviewInput): PullRequestReview {
  const files = input.files
  const missingTests = buildMissingTestFindings(files)
  const securityConcerns = buildSecurityConcerns(input.pullRequest.title, input.pullRequest.body, files)
  const breakingChanges = buildBreakingChangeFindings(files)
  const affectedModules = buildPullRequestModuleImpacts(files)
  const suggestedComments = buildSuggestedReviewComments(files, missingTests, securityConcerns, breakingChanges)
  const risk = scorePullRequestReviewRisk(input.pullRequest, files, missingTests, securityConcerns, breakingChanges)

  return {
    id: `#${input.pullRequest.number}`,
    repositoryFullName: input.repositoryFullName,
    title: input.pullRequest.title,
    url: input.pullRequest.url,
    author: input.pullRequest.author,
    state: input.pullRequest.draft ? 'draft' : input.pullRequest.state,
    risk,
    changedFiles: input.pullRequest.changedFiles,
    additions: input.pullRequest.additions,
    deletions: input.pullRequest.deletions,
    summary: buildPullRequestSummary(input.repositoryFullName, input.pullRequest, affectedModules, risk),
    affectedModules,
    missingTests,
    securityConcerns,
    breakingChanges,
    suggestedComments,
    checklist: buildReviewChecklist(risk, missingTests, securityConcerns, breakingChanges),
    analyzedAt: (input.analyzedAt ?? new Date()).toISOString()
  }
}

function scorePullRequestReviewRisk(
  pullRequest: PullRequestDetailSnapshot,
  files: PullRequestFileSnapshot[],
  missingTests: string[],
  securityConcerns: string[],
  breakingChanges: string[]
): RiskLevel {
  if (
    pullRequest.changedFiles >= 20 ||
    securityConcerns.length > 0 ||
    breakingChanges.length > 1 ||
    /auth|security|billing|payment|migration|token|secret/i.test(pullRequest.title)
  ) {
    return 'High'
  }

  if (
    pullRequest.changedFiles >= 8 ||
    pullRequest.additions + pullRequest.deletions >= 500 ||
    missingTests.length > 0 ||
    breakingChanges.length > 0 ||
    files.some((file) => classifyPullRequestModule(file.filename) === 'API')
  ) {
    return 'Medium'
  }

  return 'Low'
}

function buildPullRequestSummary(
  repositoryFullName: string,
  pullRequest: PullRequestDetailSnapshot,
  modules: PullRequestModuleImpact[],
  risk: RiskLevel
) {
  const moduleText = modules.slice(0, 3).map((module) => module.name).join(', ') || 'repository files'
  const sizeText = `${pullRequest.changedFiles} files, +${pullRequest.additions}/-${pullRequest.deletions}`

  return `${pullRequest.title} changes ${moduleText} in ${repositoryFullName}. CodeAtlas rates this PR as ${risk} risk based on ${sizeText}.`
}

function buildPullRequestModuleImpacts(files: PullRequestFileSnapshot[]): PullRequestModuleImpact[] {
  const groups = new Map<string, PullRequestFileSnapshot[]>()

  for (const file of files) {
    const moduleName = classifyPullRequestModule(file.filename)
    groups.set(moduleName, [...(groups.get(moduleName) ?? []), file])
  }

  return Array.from(groups.entries())
    .map(([name, moduleFiles]) => {
      const totalChanges = moduleFiles.reduce((total, file) => total + file.changes, 0)
      const hasSensitiveFile = moduleFiles.some((file) => isSensitivePath(file.filename))
      const risk: RiskLevel = hasSensitiveFile || totalChanges >= 350 ? 'High' : totalChanges >= 120 || moduleFiles.length >= 4 ? 'Medium' : 'Low'

      return {
        name,
        files: moduleFiles.length,
        risk,
        reason: buildModuleImpactReason(name, moduleFiles, totalChanges)
      }
    })
    .sort((a, b) => riskWeight(b.risk) - riskWeight(a.risk) || b.files - a.files)
}

function buildMissingTestFindings(files: PullRequestFileSnapshot[]) {
  const productionFiles = files.filter((file) => isProductionCodePath(file.filename))
  const testFiles = files.filter((file) => isTestPath(file.filename))
  const findings: string[] = []

  if (productionFiles.length > 0 && testFiles.length === 0) {
    findings.push(`No test files changed while ${productionFiles.length} production files were modified.`)
  }

  if (productionFiles.some((file) => classifyPullRequestModule(file.filename) === 'API') && !testFiles.some((file) => /api|server|route/i.test(file.filename))) {
    findings.push('API-facing changes do not include matching API or route tests.')
  }

  if (productionFiles.some((file) => classifyPullRequestModule(file.filename) === 'Database') && !testFiles.some((file) => /migration|schema|database|prisma/i.test(file.filename))) {
    findings.push('Database or schema changes need migration and rollback coverage.')
  }

  return findings.slice(0, 4)
}

function buildSecurityConcerns(title: string, body: string, files: PullRequestFileSnapshot[]) {
  const haystack = `${title}\n${body}`
  const concerns: string[] = []

  if (/auth|token|secret|password|permission|oauth|session/i.test(haystack)) {
    concerns.push('PR text references auth, token, secret, permission, or session behavior; review access-control paths carefully.')
  }

  if (files.some((file) => isSensitivePath(file.filename))) {
    concerns.push('Sensitive configuration or credential-like file paths changed.')
  }

  if (files.some((file) => /dangerouslySetInnerHTML|innerHTML\s*=|eval\(|new Function\(|document\.write/i.test(file.patch ?? ''))) {
    concerns.push('Patch includes unsafe client-side execution or HTML injection primitives.')
  }

  if (files.some((file) => /\bprocess\.env\b|import\.meta\.env/i.test(file.patch ?? '')) && !files.some((file) => /env\.example|config|schema|validation/i.test(file.filename))) {
    concerns.push('Environment variable usage changed without an obvious config or example update.')
  }

  return concerns.slice(0, 5)
}

function buildBreakingChangeFindings(files: PullRequestFileSnapshot[]) {
  const findings: string[] = []

  if (files.some((file) => /(^|\/)(migrations?|prisma\/schema\.prisma|schema\.sql)/i.test(file.filename))) {
    findings.push('Database schema or migration files changed; confirm backward compatibility and rollback path.')
  }

  if (files.some((file) => /(^|\/)(api|server|routes|controllers)\//i.test(file.filename))) {
    findings.push('API route or controller files changed; confirm response contract compatibility.')
  }

  if (files.some((file) => file.status === 'removed' && isProductionCodePath(file.filename))) {
    findings.push('Production files were removed; confirm imports, routing, and deployment references.')
  }

  if (files.some((file) => /package\.json|lock|Dockerfile|docker-compose|nuxt\.config|next\.config|vite\.config/i.test(file.filename))) {
    findings.push('Runtime or build configuration changed; run full build and deployment smoke tests.')
  }

  return findings.slice(0, 5)
}

function buildSuggestedReviewComments(
  files: PullRequestFileSnapshot[],
  missingTests: string[],
  securityConcerns: string[],
  breakingChanges: string[]
): ReviewCommentSuggestion[] {
  const fallbackFile = files[0]?.filename ?? 'Pull request'
  const comments: ReviewCommentSuggestion[] = []

  for (const concern of securityConcerns) {
    comments.push({
      file: findFileForConcern(files, concern) ?? fallbackFile,
      severity: 'High',
      message: 'Please add an explicit security note or test coverage for this change path.',
      rationale: concern
    })
  }

  for (const finding of missingTests) {
    comments.push({
      file: findProductionFile(files) ?? fallbackFile,
      severity: 'Medium',
      message: 'Please add or point to tests covering this production behavior.',
      rationale: finding
    })
  }

  for (const finding of breakingChanges) {
    comments.push({
      file: findBreakingChangeFile(files) ?? fallbackFile,
      severity: 'Medium',
      message: 'Please confirm compatibility, rollout, and rollback expectations.',
      rationale: finding
    })
  }

  if (!comments.length) {
    comments.push({
      file: fallbackFile,
      severity: 'Low',
      message: 'Looks low risk from the changed-file metadata; verify the main happy path manually.',
      rationale: 'No obvious missing tests, security concerns, or breaking-change indicators were detected.'
    })
  }

  return comments.slice(0, 5)
}

function buildReviewChecklist(
  risk: RiskLevel,
  missingTests: string[],
  securityConcerns: string[],
  breakingChanges: string[]
) {
  const checklist = [
    'Run repository typecheck and build before merge.',
    'Verify the changed user flow locally or in preview.'
  ]

  if (missingTests.length) {
    checklist.push('Add targeted tests or document why existing coverage is sufficient.')
  }

  if (securityConcerns.length) {
    checklist.push('Confirm secrets, permissions, and output handling are safe.')
  }

  if (breakingChanges.length) {
    checklist.push('Document rollout, rollback, and compatibility impact.')
  }

  if (risk === 'High') {
    checklist.push('Require senior review before merge.')
  }

  return checklist
}

function classifyPullRequestModule(path: string) {
  if (isTestPath(path)) {
    return 'Tests'
  }

  if (/readme|docs?\//i.test(path)) {
    return 'Documentation'
  }

  if (/\.github\/workflows|Dockerfile|docker-compose|package\.json|lock|config|tsconfig/i.test(path)) {
    return 'Build and CI'
  }

  if (/prisma|migrations?|schema\.sql|database|db\//i.test(path)) {
    return 'Database'
  }

  if (/auth|session|permission|oauth|token|secret/i.test(path)) {
    return 'Auth and Security'
  }

  if (/(^|\/)(api|server|routes|controllers)\//i.test(path)) {
    return 'API'
  }

  if (/(^|\/)(worker|workers|jobs|queues?)\//i.test(path)) {
    return 'Workers'
  }

  if (/(^|\/)(pages|app|components|views|layouts)\//i.test(path) || /\.(vue|tsx|jsx)$/i.test(path)) {
    return 'Frontend'
  }

  return 'Core'
}

function buildModuleImpactReason(name: string, files: PullRequestFileSnapshot[], totalChanges: number) {
  const topFile = files.slice().sort((a, b) => b.changes - a.changes)[0]

  return `${files.length} ${files.length === 1 ? 'file' : 'files'} and ${totalChanges} changed lines; largest change is ${topFile?.filename ?? name}.`
}

function isProductionCodePath(path: string) {
  return (
    SOURCE_EXTENSIONS.has(extension(path)) &&
    !isTestPath(path) &&
    !/readme|docs?\//i.test(path) &&
    !/lock$|package-lock\.json|pnpm-lock\.yaml|yarn\.lock/i.test(path)
  )
}

function isTestPath(path: string) {
  return /(^|\/)(test|tests|__tests__|spec)\//i.test(path) || /\.(test|spec)\./i.test(path)
}

function isSensitivePath(path: string) {
  return /(^|\/)\.env($|[./-])|secret|private[_-]?key|id_rsa|\.pem$|\.p12$|credentials/i.test(path)
}

function findFileForConcern(files: PullRequestFileSnapshot[], concern: string) {
  if (/credential|secret|sensitive/i.test(concern)) {
    return files.find((file) => isSensitivePath(file.filename))?.filename
  }

  if (/environment/i.test(concern)) {
    return files.find((file) => /\bprocess\.env\b|import\.meta\.env/i.test(file.patch ?? ''))?.filename
  }

  if (/unsafe|HTML|execution/i.test(concern)) {
    return files.find((file) => /dangerouslySetInnerHTML|innerHTML\s*=|eval\(|new Function\(|document\.write/i.test(file.patch ?? ''))?.filename
  }

  return files.find((file) => /auth|session|permission|oauth|token|secret/i.test(file.filename))?.filename
}

function findProductionFile(files: PullRequestFileSnapshot[]) {
  return files.find((file) => isProductionCodePath(file.filename))?.filename
}

function findBreakingChangeFile(files: PullRequestFileSnapshot[]) {
  return files.find((file) => /(^|\/)(api|server|routes|controllers|migrations?|prisma)|schema|package\.json|Dockerfile|config/i.test(file.filename))?.filename
}

function riskWeight(risk: RiskLevel) {
  return risk === 'High' ? 3 : risk === 'Medium' ? 2 : 1
}

function buildStrengthText(files: RepositoryFile[], technologies: string[]) {
  const paths = files.map((file) => file.path)
  const strengths: string[] = []

  if (paths.some((path) => path.startsWith('.github/workflows/'))) {
    strengths.push('CI workflows')
  }

  if (paths.some((path) => path.toLowerCase().includes('readme'))) {
    strengths.push('README documentation')
  }

  if (technologies.includes('TypeScript')) {
    strengths.push('TypeScript types')
  }

  if (paths.some((path) => /(^|\/)(test|tests|__tests__|spec)\//i.test(path) || /\.(test|spec)\./i.test(path))) {
    strengths.push('test coverage signals')
  }

  return strengths.length ? `${strengths.join(', ')} are visible in the repository tree.` : 'Repository structure is readable enough for the first analysis pass.'
}

function scoreImportantPath(path: string) {
  let score = 0

  if (IMPORTANT_FILES.some((file) => path === file || path.endsWith(`/${file}`))) {
    score += 100
  }

  if (/^src\/(main|index|app)\./i.test(path) || /(^|\/)(main|index|app)\.(ts|tsx|js|jsx|vue|py|go|rs)$/i.test(path)) {
    score += 80
  }

  if (/^apps?\//i.test(path) || /^packages?\//i.test(path)) {
    score += 35
  }

  if (/test|spec/i.test(path)) {
    score += 10
  }

  return score - path.split('/').length
}

function isReferenceCandidate(path: string) {
  if (IMPORTANT_FILES.some((file) => path === file || path.endsWith(`/${file}`))) {
    return true
  }

  return SOURCE_EXTENSIONS.has(extension(path)) && !/lock$|\.min\./i.test(path)
}

function classifyService(path: string) {
  if (/readme/i.test(path)) {
    return 'Documentation'
  }

  if (/package\.json|tsconfig|config|lock|Dockerfile|\.ya?ml$/i.test(path)) {
    return 'Project Config'
  }

  if (/(^|\/)(pages|app|components|views)\//i.test(path)) {
    return 'Frontend'
  }

  if (/(^|\/)(api|server|routes|controllers)\//i.test(path)) {
    return 'API'
  }

  if (/(^|\/)(worker|workers|jobs|queues?)\//i.test(path)) {
    return 'Worker'
  }

  if (/test|spec/i.test(path)) {
    return 'Tests'
  }

  return 'Source'
}

function describeFile(path: string) {
  if (/readme/i.test(path)) {
    return 'Repository onboarding documentation'
  }

  if (path.endsWith('package.json')) {
    return 'Node package manifest and scripts'
  }

  if (/config|tsconfig|Dockerfile|\.ya?ml$/i.test(path)) {
    return 'Project configuration'
  }

  if (/(^|\/)(main|index|app)\./i.test(path)) {
    return 'Likely application entrypoint'
  }

  if (/test|spec/i.test(path)) {
    return 'Test coverage signal'
  }

  return 'Source module selected from repository tree'
}

function fileType(path: string) {
  if (path === 'Dockerfile' || path.endsWith('/Dockerfile')) {
    return 'DOCKER'
  }

  return SOURCE_EXTENSIONS.get(extension(path)) ?? 'FILE'
}

function extension(path: string) {
  const dotIndex = path.lastIndexOf('.')

  return dotIndex === -1 ? '' : path.slice(dotIndex)
}

function estimateLoc(files: RepositoryFile[]) {
  return files.reduce((total, file) => total + estimateFileLoc(file.size), 0)
}

function estimateFileLoc(size = 0) {
  if (!size) {
    return 0
  }

  return Math.max(1, Math.round(size / 45))
}

function firstReadmeSentence(readme: string) {
  return readme
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .split(/[.!?]/)
    .map((sentence) => sentence.trim())
    .find((sentence) => sentence.length > 24 && sentence.length < 180)
}

function firstMatchingTechnology(technologies: string[], candidates: string[]) {
  return candidates.find((candidate) => technologies.includes(candidate))
}

function hasFrontend(technologies: string[], paths: string[]) {
  return (
    technologies.some((technology) => ['Nuxt', 'Next.js', 'Vue', 'React', 'Vite'].includes(technology)) ||
    paths.some((path) => /(^|\/)(pages|app|components|views)\//i.test(path))
  )
}

function addIf(condition: boolean, technology: string, techs: Set<string>) {
  if (condition) {
    techs.add(technology)
  }
}
