<script setup lang="ts">
import type { ArchitectureNode, SourceReference } from '~/types/codeatlas'

const props = withDefaults(defineProps<{
  nodes: ArchitectureNode[]
  references?: SourceReference[]
  riskSignals?: string[]
}>(), {
  references: () => [],
  riskSignals: () => []
})

const columns = [
  { id: 'entry', label: 'Entry' },
  { id: 'backend', label: 'Backend' },
  { id: 'workers', label: 'Workers' },
  { id: 'data', label: 'Data' }
] as const

const selectedNodeId = ref(props.nodes[0]?.id ?? '')

const nodeTone: Record<ArchitectureNode['kind'], string> = {
  api: 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500',
  service: 'border-blue-300 bg-blue-50 text-blue-950 hover:border-blue-500',
  worker: 'border-violet-300 bg-violet-50 text-violet-950 hover:border-violet-500',
  data: 'border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-500',
  external: 'border-slate-300 bg-slate-50 text-slate-900 hover:border-slate-500'
}

const kindLabel: Record<ArchitectureNode['kind'], string> = {
  api: 'API',
  service: 'Service',
  worker: 'Worker',
  data: 'Data',
  external: 'External'
}

const selectedNode = computed(() => props.nodes.find((node) => node.id === selectedNodeId.value) ?? props.nodes[0])
const selectedReferences = computed(() => {
  const node = selectedNode.value

  if (!node) {
    return []
  }

  const label = node.label.toLowerCase()
  const detail = node.detail.toLowerCase()

  return props.references
    .filter((reference) => {
      const haystack = `${reference.file} ${reference.service} ${reference.description}`.toLowerCase()

      return haystack.includes(label) || haystack.includes(detail) || label.includes(reference.service.toLowerCase())
    })
    .slice(0, 4)
})

const selectedRisks = computed(() => {
  const node = selectedNode.value

  if (!node) {
    return []
  }

  const label = node.label.toLowerCase()
  const detail = node.detail.toLowerCase()

  return props.riskSignals
    .filter((risk) => {
      const normalized = risk.toLowerCase()

      return normalized.includes(label) || normalized.includes(detail) || normalized.includes(node.kind)
    })
    .slice(0, 3)
})

const nodesByColumn = (column: ArchitectureNode['column']) => props.nodes.filter((node) => node.column === column)

watch(
  () => props.nodes,
  (nodes) => {
    if (!nodes.some((node) => node.id === selectedNodeId.value)) {
      selectedNodeId.value = nodes[0]?.id ?? ''
    }
  }
)
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex flex-col gap-2 border-b border-atlas-line px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div class="flex items-center gap-2">
        <h2 class="ui-title text-base">Architecture map</h2>
        <span class="ui-span text-xs text-atlas-muted">Click a node to inspect ownership</span>
      </div>
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="ui-span inline-flex items-center gap-1 text-xs text-atlas-muted">
          <span class="ui-span h-2.5 w-2.5 rounded-sm bg-emerald-400"></span>
          API
        </span>
        <span class="ui-span inline-flex items-center gap-1 text-xs text-atlas-muted">
          <span class="ui-span h-2.5 w-2.5 rounded-sm bg-blue-400"></span>
          Service
        </span>
        <span class="ui-span inline-flex items-center gap-1 text-xs text-atlas-muted">
          <span class="ui-span h-2.5 w-2.5 rounded-sm bg-violet-400"></span>
          Worker
        </span>
        <span class="ui-span inline-flex items-center gap-1 text-xs text-atlas-muted">
          <span class="ui-span h-2.5 w-2.5 rounded-sm bg-amber-400"></span>
          Data
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div class="relative min-h-[430px] overflow-x-auto overflow-y-hidden bg-[radial-gradient(circle_at_1px_1px,#dce3ea_1px,transparent_0)] p-5 [background-size:18px_18px]">
        <svg aria-hidden="true" class="pointer-events-none absolute inset-0 h-full w-full text-slate-400/80" viewBox="0 0 960 430" preserveAspectRatio="none">
          <path d="M122 210 C220 210 218 104 315 104" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M122 210 C220 210 218 182 315 182" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M122 210 C220 210 218 260 315 260" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M430 134 C522 134 520 112 606 112" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M430 260 C522 260 520 228 606 228" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M710 112 C780 112 780 164 846 164" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M710 228 C780 228 780 236 846 236" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>

        <div class="relative grid h-full min-w-[720px] grid-cols-4 gap-5 xl:min-w-0 xl:gap-6">
          <div v-for="column in columns" :key="column.id" class="flex flex-col justify-center gap-4">
            <div class="mb-1 text-center">
              <span class="ui-span rounded border border-atlas-border bg-white px-2 py-1 text-xs font-medium text-atlas-muted">
                {{ column.label }}
              </span>
            </div>
            <button
              v-for="node in nodesByColumn(column.id)"
              :key="node.id"
              type="button"
              class="ui-button w-full flex-col items-start gap-1 rounded-atlas border px-3 py-3 text-left shadow-sm"
              :class="[nodeTone[node.kind], selectedNode?.id === node.id ? 'ring-2 ring-atlas-accent/30' : '']"
              :aria-pressed="selectedNode?.id === node.id"
              @click="selectedNodeId = node.id"
            >
              <span class="ui-span flex w-full items-center justify-between gap-2">
                <span class="ui-span min-w-0 text-sm font-semibold leading-5">{{ node.label }}</span>
                <span class="ui-span rounded bg-white/80 px-2 py-0.5 text-[11px] font-semibold">{{ kindLabel[node.kind] }}</span>
              </span>
              <span class="ui-span text-xs opacity-80">{{ node.detail }}</span>
            </button>
          </div>
        </div>
      </div>

      <aside class="border-t border-atlas-line bg-white xl:border-l xl:border-t-0">
        <div v-if="selectedNode" class="flex h-full flex-col">
          <div class="border-b border-atlas-line px-4 py-4">
            <span class="ui-span rounded bg-atlas-rail px-2 py-1 text-xs font-semibold text-atlas-accent">{{ kindLabel[selectedNode.kind] }}</span>
            <h3 class="ui-title mt-3 text-xl">{{ selectedNode.label }}</h3>
            <p class="mt-2 text-sm leading-6 text-atlas-muted">{{ selectedNode.detail }}</p>
          </div>

          <div class="space-y-4 px-4 py-4">
            <section>
              <h4 class="ui-title text-sm">Source ownership</h4>
              <div v-if="selectedReferences.length" class="mt-3 space-y-2">
                <article v-for="reference in selectedReferences" :key="reference.file" class="rounded-atlas border border-atlas-line bg-atlas-canvas px-3 py-2">
                  <p class="truncate text-sm font-semibold text-atlas-ink">{{ reference.file }}</p>
                  <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ reference.description }}</p>
                </article>
              </div>
              <p v-else class="mt-3 rounded-atlas border border-atlas-line bg-atlas-canvas px-3 py-3 text-sm leading-5 text-atlas-muted">
                No direct files matched this node yet. Ask CodeAtlas for the exact source path before changing it.
              </p>
            </section>

            <section>
              <h4 class="ui-title text-sm">Signals</h4>
              <div v-if="selectedRisks.length" class="mt-3 space-y-2">
                <p v-for="risk in selectedRisks" :key="risk" class="rounded-atlas border border-red-100 bg-red-50 px-3 py-2 text-sm leading-5 text-atlas-danger">
                  {{ risk }}
                </p>
              </div>
              <p v-else class="mt-3 rounded-atlas border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm leading-5 text-atlas-success">
                No direct risk signal is attached to this node.
              </p>
            </section>

            <section class="rounded-atlas border border-atlas-border bg-atlas-canvas p-3">
              <h4 class="ui-title text-sm">Recommended next action</h4>
              <p class="mt-2 text-sm leading-5 text-atlas-muted">
                Review the ownership files, then ask CodeAtlas to explain coupling and tests for {{ selectedNode.label }}.
              </p>
            </section>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>
