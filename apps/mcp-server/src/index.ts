#!/usr/bin/env node
import {
  analyzePullRequestSnapshot,
  analyzeRepositorySnapshot,
  type AnalyzeRepositorySnapshotInput,
  type PullRequestReviewInput
} from '@codeatlas/analyzer'

interface JsonRpcRequest {
  jsonrpc?: '2.0'
  id?: string | number | null
  method?: string
  params?: unknown
}

interface ToolCallParams {
  name?: string
  arguments?: unknown
}

const tools = [
  {
    name: 'analyze_repository_snapshot',
    description: 'Analyze a repository snapshot and return CodeAtlas architecture, references, risks, and summary.',
    inputSchema: {
      type: 'object',
      required: ['repository', 'files', 'readme', 'packageManifests', 'pullRequests', 'treeTruncated'],
      properties: {
        repository: { type: 'object' },
        files: { type: 'array' },
        readme: { type: 'string' },
        packageManifests: { type: 'array' },
        pullRequests: { type: 'array' },
        treeTruncated: { type: 'boolean' }
      }
    }
  },
  {
    name: 'review_pull_request_snapshot',
    description: 'Review a pull request snapshot and return affected modules, risks, missing tests, and suggested comments.',
    inputSchema: {
      type: 'object',
      required: ['repositoryFullName', 'pullRequest', 'files'],
      properties: {
        repositoryFullName: { type: 'string' },
        pullRequest: { type: 'object' },
        files: { type: 'array' }
      }
    }
  }
]

let inputBuffer = ''

process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  inputBuffer += chunk
  drainInputBuffer()
})

function drainInputBuffer() {
  let newlineIndex = inputBuffer.indexOf('\n')

  while (newlineIndex !== -1) {
    const line = inputBuffer.slice(0, newlineIndex).trim()
    inputBuffer = inputBuffer.slice(newlineIndex + 1)

    if (line) {
      handleLine(line)
    }

    newlineIndex = inputBuffer.indexOf('\n')
  }
}

function handleLine(line: string) {
  try {
    const request = JSON.parse(line) as JsonRpcRequest
    const result = handleRequest(request)

    if (request.id !== undefined) {
      writeResponse({ jsonrpc: '2.0', id: request.id, result })
    }
  } catch (error) {
    writeResponse({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Unexpected MCP server error'
      }
    })
  }
}

function handleRequest(request: JsonRpcRequest) {
  switch (request.method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'codeatlas',
          version: '0.0.0'
        }
      }
    case 'tools/list':
      return { tools }
    case 'tools/call':
      return callTool(request.params as ToolCallParams)
    default:
      throw new Error(`Unsupported method: ${request.method ?? 'unknown'}`)
  }
}

function callTool(params: ToolCallParams) {
  if (params.name === 'analyze_repository_snapshot') {
    const analysis = analyzeRepositorySnapshot(params.arguments as AnalyzeRepositorySnapshotInput)

    return jsonToolResult(analysis)
  }

  if (params.name === 'review_pull_request_snapshot') {
    const review = analyzePullRequestSnapshot(params.arguments as PullRequestReviewInput)

    return jsonToolResult(review)
  }

  throw new Error(`Unsupported tool: ${params.name ?? 'unknown'}`)
}

function jsonToolResult(value: unknown) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2)
      }
    ]
  }
}

function writeResponse(payload: unknown) {
  process.stdout.write(`${JSON.stringify(payload)}\n`)
}
