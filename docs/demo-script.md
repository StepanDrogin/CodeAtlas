# CodeAtlas Demo Script

Use this script for a portfolio walkthrough or recorded demo.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Optional: set `NUXT_GITHUB_TOKEN` in `.env` to avoid GitHub unauthenticated rate limits.

## Walkthrough

1. Open `http://localhost:3000`.
2. Paste a public repository URL, for example `github.com/nuxt/nuxt`.
3. Run repository analysis and show:
   - architecture map
   - Analysis summary
   - source references
   - repository risk signals
4. Ask a local question in the command bar:
   - `Where is app config handled?`
   - `Which files should I inspect before changing routing?`
5. Open PR Review and paste a public PR URL:
   - `https://github.com/nuxt/nuxt/pull/35489`
6. Show:
   - affected modules
   - missing test signals
   - security concerns
   - breaking-change signals
   - suggested review comments
7. Mention the production scaffolding:
   - GitHub Action in `apps/github-action`
   - MCP server in `apps/mcp-server`
   - CI in `.github/workflows/ci.yml`
   - Docker Compose in `docker-compose.yml`

## Human Setup Still Required

- Create a real GitHub token for higher API limits.
- Deploy the Nuxt app before using the GitHub Action from GitHub-hosted runners.
- Record screenshots or a short GIF for the README.
- Decide whether private repositories should use GitHub App auth or personal tokens.
