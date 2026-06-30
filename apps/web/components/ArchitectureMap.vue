<script setup lang="ts">
import type { ArchitectureNode } from '~/types/codeatlas'

const props = defineProps<{
  nodes: ArchitectureNode[]
}>()

const columns = [
  { id: 'entry', label: 'Entry' },
  { id: 'backend', label: 'Backend' },
  { id: 'workers', label: 'Workers' },
  { id: 'data', label: 'Data' }
] as const

const nodeTone: Record<ArchitectureNode['kind'], string> = {
  api: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  service: 'border-blue-300 bg-blue-50 text-blue-950',
  worker: 'border-violet-300 bg-violet-50 text-violet-950',
  data: 'border-amber-300 bg-amber-50 text-amber-950',
  external: 'border-slate-300 bg-slate-50 text-slate-900'
}

const nodesByColumn = (column: ArchitectureNode['column']) => props.nodes.filter((node) => node.column === column)
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex flex-col gap-2 border-b border-atlas-line px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div class="flex items-center gap-2">
        <h2 class="ui-title text-base">Architecture map</h2>
        <span class="ui-span text-xs text-atlas-muted">Grouped by layer</span>
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

    <div class="relative min-h-[390px] overflow-x-auto overflow-y-hidden bg-[radial-gradient(circle_at_1px_1px,#dce3ea_1px,transparent_0)] p-5 [background-size:18px_18px]">
      <svg aria-hidden="true" class="pointer-events-none absolute inset-0 h-full w-full text-slate-400" viewBox="0 0 960 390" preserveAspectRatio="none">
        <path d="M122 198 C220 198 218 96 315 96" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M122 198 C220 198 218 172 315 172" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M122 198 C220 198 218 248 315 248" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M430 126 C522 126 520 104 606 104" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M430 248 C522 248 520 214 606 214" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M710 104 C780 104 780 154 846 154" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M710 214 C780 214 780 222 846 222" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>

      <div class="relative grid h-full min-w-[680px] grid-cols-4 gap-5 xl:min-w-0 xl:gap-6">
        <div v-for="column in columns" :key="column.id" class="flex flex-col justify-center gap-4">
          <div class="mb-1 text-center">
            <span class="ui-span rounded border border-atlas-border bg-white px-2 py-1 text-xs font-medium text-atlas-muted">
              {{ column.label }}
            </span>
          </div>
          <div
            v-for="node in nodesByColumn(column.id)"
            :key="node.id"
            class="rounded-atlas border px-3 py-3 shadow-sm"
            :class="nodeTone[node.kind]"
          >
            <p class="text-sm font-semibold">{{ node.label }}</p>
            <p class="mt-1 text-xs opacity-80">{{ node.detail }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
