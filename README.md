# CodeAtlas

AI-powered codebase intelligence platform for GitHub repositories.

CodeAtlas turns a repository into an architecture map, searchable project knowledge base, PR review assistant, and observability view for AI analysis jobs.

## MVP Scope

- Public GitHub repository URL analysis flow powered by the GitHub REST API.
- Repository metadata, tree, README, package manifests, and open pull requests.
- Architecture map for services, workers, data stores, and external integrations.
- Heuristic summary with purpose, architecture, strengths, risks, and opportunities.
- Source references table with file search and typed module filters.
- PR review queue with risk levels, changed files, and open/draft status.
- PR deep review mode with affected modules, missing tests, security concerns, breaking-change signals, and suggested comments.
- Observability strip for latency, error rate, requests, token usage, cost, and jobs.
- MCP server scaffold for AI coding tools.
- Composite GitHub Action scaffold for PR review workflows.
- CI and Docker packaging.

## Tech Stack

- Nuxt 3
- Vue 3 Composition API
- TypeScript
- Tailwind CSS with project design tokens
- npm workspaces

## Project Structure

```text
apps/
  github-action/  Composite GitHub Action scaffold
  mcp-server/     Dependency-free MCP stdio server
  web/            Nuxt dashboard app
docs/
  design/         Generated UI concept references
packages/
  analyzer/       Pure repository and PR analysis package
```

## Local Development

```bash
npm install
npm run dev
```

The web app runs from `apps/web`.

For higher GitHub API limits, set `NUXT_GITHUB_TOKEN` before starting the dev server. Public repositories work without a token until the unauthenticated GitHub API rate limit is reached.

## Quality Gates

```bash
npm run typecheck
npm run test
npm run build
```

The analyzer package is built and tested separately before the Nuxt app consumes it. The MCP server is also typechecked and built from the root quality gates.

## Docker

```bash
docker compose up --build
```

The container exposes the Nuxt app on `http://localhost:3000`.

## API Surface

```text
POST /api/repositories/analyze
body: { "repository": "github.com/owner/repo" }

POST /api/pull-requests/review
body: { "pullRequest": "github.com/owner/repo/pull/123" }
```

Both endpoints use the GitHub REST API and share the same `NUXT_GITHUB_TOKEN` runtime config.

## MCP Server

```bash
npm run build -w @codeatlas/mcp-server
node apps/mcp-server/dist/index.js
```

Implemented tools:

- `analyze_repository_snapshot`
- `review_pull_request_snapshot`

The server is intentionally dependency-free and delegates analysis to `@codeatlas/analyzer`.

## GitHub Action

The composite action lives in `apps/github-action`.

```yaml
- uses: ./apps/github-action
  with:
    codeatlas-api-url: https://your-codeatlas.example.com
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Human setup still required: deploy the Nuxt app somewhere reachable by GitHub Actions, then pass that URL as `codeatlas-api-url`.

## Architecture Direction

```mermaid
flowchart LR
  Web[Nuxt dashboard] --> API[CodeAtlas API]
  API --> GitHub[GitHub REST API]
  API --> Analyzer[Analyzer package]
  MCP[MCP server] --> Analyzer
  Action[GitHub Action] --> API
  Analyzer --> UI[Architecture, references, risks, PR review]
```

## Roadmap

- Add persisted analysis jobs and background workers.
- Add embeddings and semantic code search.
- Add codebase Q&A with exact file and line references.
- Turn the GitHub Action into a published Marketplace action.
- Add private repository support through GitHub App installation.
- Add OpenTelemetry tracing and real cost dashboards.
