import assert from 'node:assert/strict'
import test from 'node:test'
import {
  analyzePullRequestSnapshot,
  analyzeRepositorySnapshot,
  buildRiskSignals,
  detectTechnologies,
  scorePullRequestRisk
} from '@codeatlas/analyzer'

const packageManifest = {
  path: 'package.json',
  content: JSON.stringify({
    dependencies: {
      '@prisma/client': '5.0.0',
      fastify: '4.0.0',
      nuxt: '3.0.0',
      vue: '3.0.0'
    },
    devDependencies: {
      tailwindcss: '3.0.0',
      typescript: '5.0.0',
      vitest: '1.0.0'
    }
  })
}

const files = [
  { path: 'README.md', size: 900 },
  { path: 'package.json', size: 650 },
  { path: 'pnpm-lock.yaml', size: 30000 },
  { path: 'apps/web/app.vue', size: 1200 },
  { path: 'apps/api/server/routes/analyze.ts', size: 1800 },
  { path: 'packages/analyzer/src/index.ts', size: 3200 },
  { path: 'packages/analyzer/src/index.test.ts', size: 1000 },
  { path: '.github/workflows/ci.yml', size: 700 },
  { path: 'prisma/schema.prisma', size: 1100 }
]

test('analyzeRepositorySnapshot builds the UI contract from a repository snapshot', () => {
  const result = analyzeRepositorySnapshot({
    repository: {
      fullName: 'acme/codeatlas',
      description: 'AI codebase intelligence platform',
      defaultBranch: 'main',
      url: 'https://github.com/acme/codeatlas',
      language: 'TypeScript',
      stars: 120,
      forks: 8
    },
    files,
    readme: '# CodeAtlas\n\nAI codebase intelligence platform for GitHub repositories.',
    packageManifests: [packageManifest],
    pullRequests: [
      {
        number: 42,
        title: 'Refactor billing API',
        changedFiles: 6,
        draft: false
      }
    ],
    treeTruncated: false,
    analyzedAt: new Date('2026-06-29T10:00:00.000Z')
  })

  assert.equal(result.repository.fullName, 'acme/codeatlas')
  assert.equal(result.repository.fileCount, files.length)
  assert.equal(result.repository.truncated, false)
  assert.equal(result.analyzedAt, '2026-06-29T10:00:00.000Z')
  assert.ok(result.repository.estimatedLoc > 0)

  assert.deepEqual(new Set(result.technologies), new Set([
    'TypeScript',
    'Node.js',
    'Nuxt',
    'Tailwind CSS',
    'Vue',
    'GitHub Actions',
    'Prisma',
    'Fastify',
    'Vitest'
  ]))

  assert.ok(result.architectureNodes.some((node) => node.id === 'api'))
  assert.ok(result.architectureNodes.some((node) => node.id === 'ci'))
  assert.ok(result.sourceReferences.some((reference) => reference.file === 'package.json'))
  assert.equal(result.pullRequests[0].id, '#42')
  assert.equal(result.pullRequests[0].risk, 'High')
  assert.equal(result.pullRequests[0].checks, 'Open')
  assert.equal(result.riskSignals.length, 0)
  assert.ok(result.answer.includes('acme/codeatlas'))
})

test('detectTechnologies keeps path-based signals when a package manifest is invalid', () => {
  const technologies = detectTechnologies(
    [
      { path: 'src/main.ts' },
      { path: 'package.json' },
      { path: 'tailwind.config.ts' },
      { path: 'Dockerfile' }
    ],
    [{ path: 'package.json', content: '{invalid json' }],
    ''
  )

  assert.deepEqual(technologies, ['TypeScript', 'Node.js', 'Tailwind CSS', 'Docker'])
})

test('scorePullRequestRisk escalates sensitive and broad changes', () => {
  assert.equal(scorePullRequestRisk(2, 'Fix typo'), 'Low')
  assert.equal(scorePullRequestRisk(8, 'Refactor cache layer'), 'Medium')
  assert.equal(scorePullRequestRisk(3, 'Rotate auth token handling'), 'High')
  assert.equal(scorePullRequestRisk(24, 'Update generated clients'), 'High')
})

test('analyzePullRequestSnapshot summarizes review risk and suggested comments', () => {
  const review = analyzePullRequestSnapshot({
    repositoryFullName: 'acme/codeatlas',
    pullRequest: {
      number: 88,
      title: 'Update auth token middleware',
      body: 'Changes session token validation.',
      state: 'open',
      draft: false,
      author: 'octo',
      url: 'https://github.com/acme/codeatlas/pull/88',
      baseBranch: 'main',
      headBranch: 'auth-token-refresh',
      changedFiles: 3,
      additions: 180,
      deletions: 40
    },
    files: [
      {
        filename: 'apps/api/server/middleware/auth.ts',
        status: 'modified',
        additions: 140,
        deletions: 30,
        changes: 170,
        patch: '+ const token = process.env.AUTH_TOKEN'
      },
      {
        filename: 'apps/web/components/LoginForm.vue',
        status: 'modified',
        additions: 35,
        deletions: 10,
        changes: 45
      },
      {
        filename: '.env.production',
        status: 'added',
        additions: 5,
        deletions: 0,
        changes: 5
      }
    ],
    analyzedAt: new Date('2026-06-29T12:00:00.000Z')
  })

  assert.equal(review.id, '#88')
  assert.equal(review.risk, 'High')
  assert.equal(review.analyzedAt, '2026-06-29T12:00:00.000Z')
  assert.ok(review.affectedModules.some((module) => module.name === 'Auth and Security'))
  assert.ok(review.affectedModules.some((module) => module.name === 'Frontend'))
  assert.ok(review.missingTests.some((finding) => finding.includes('No test files changed')))
  assert.ok(review.securityConcerns.some((finding) => finding.includes('Sensitive configuration')))
  assert.ok(review.suggestedComments.some((comment) => comment.severity === 'High'))
  assert.ok(review.checklist.includes('Require senior review before merge.'))
})

test('buildRiskSignals flags committed env paths and install lifecycle scripts', () => {
  const risks = buildRiskSignals(
    [
      { path: 'README.md' },
      { path: 'package.json' },
      { path: 'src/index.ts' },
      { path: '.env.local' }
    ],
    false,
    '# Demo',
    [
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            postinstall: 'node scripts/bootstrap.js'
          }
        })
      }
    ]
  )

  assert.ok(risks.some((risk) => risk.includes('Credential-like')))
  assert.ok(risks.some((risk) => risk.includes('lifecycle scripts')))
})
