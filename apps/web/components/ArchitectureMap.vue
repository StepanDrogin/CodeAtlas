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
const surroundingNodes = computed(() => props.nodes.filter((node) => node.id !== selectedNode.value?.id).slice(0, 8))
const nodePositions = [
  'left-[5%] top-[42%]',
  'left-[18%] top-[18%]',
  'left-[34%] top-[68%]',
  'left-[58%] top-[14%]',
  'left-[70%] top-[36%]',
  'left-[62%] top-[66%]',
  'left-[82%] top-[54%]',
  'left-[38%] top-[28%]'
]
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
      <div class="atlas-canvas relative min-h-[500px] overflow-x-auto overflow-y-hidden p-5">
        <div class="relative h-[460px] min-w-[760px] overflow-hidden rounded-atlas border border-atlas-line bg-white/68 shadow-insetLine xl:min-w-0">
          <svg aria-hidden="true" class="pointer-events-none absolute inset-0 h-full w-full text-slate-400/70" viewBox="0 0 960 460" preserveAspectRatio="none">
            <path d="M480 230 C360 210 280 190 170 210" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="8 8" />
            <path d="M480 230 C400 130 300 108 210 96" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M480 230 C390 295 330 330 258 352" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M480 230 C548 122 610 96 680 86" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M480 230 C604 214 688 202 760 210" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M480 230 C582 306 638 336 704 348" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="8 8" />
            <path d="M480 230 C654 256 742 292 838 304" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M480 230 C462 166 432 136 386 122" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>

          <div v-if="selectedNode" class="absolute left-1/2 top-1/2 z-10 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-atlas-accent p-4 text-center text-white shadow-instrument">
            <span class="ui-span text-xs font-semibold opacity-80">{{ kindLabel[selectedNode.kind] }}</span>
            <span class="ui-span mt-1 text-sm font-semibold leading-5">{{ selectedNode.label }}</span>
          </div>

          <button
            v-for="(node, index) in surroundingNodes"
            :key="node.id"
            type="button"
            class="ui-button absolute z-10 w-40 flex-col items-start gap-1 rounded-atlas border bg-white/94 px-3 py-3 text-left shadow-sm backdrop-blur hover:shadow-atlas"
            :class="[nodeTone[node.kind], nodePositions[index % nodePositions.length]]"
            @click="selectedNodeId = node.id"
          >
            <span class="ui-span flex w-full items-center justify-between gap-2">
              <span class="ui-span min-w-0 text-sm font-semibold leading-5">{{ node.label }}</span>
              <span class="ui-span rounded bg-white/80 px-2 py-0.5 text-[11px] font-semibold">{{ kindLabel[node.kind] }}</span>
            </span>
            <span class="ui-span text-xs opacity-80">{{ node.detail }}</span>
          </button>

          <div class="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-atlas border border-atlas-line bg-white/92 px-4 py-2 shadow-sm backdrop-blur">
            <span class="ui-span inline-flex items-center gap-1 text-xs text-atlas-muted"><span class="ui-span h-2 w-5 rounded-full bg-atlas-accent"></span>Service</span>
            <span class="ui-span inline-flex items-center gap-1 text-xs text-atlas-muted"><span class="ui-span h-2 w-5 rounded-full bg-atlas-violet"></span>Worker</span>
            <span class="ui-span inline-flex items-center gap-1 text-xs text-atlas-muted"><span class="ui-span h-2 w-5 rounded-full bg-atlas-border"></span>External</span>
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
