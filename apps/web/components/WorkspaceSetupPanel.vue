<script setup lang="ts">
import type { WorkspaceSetupStep } from '~/types/codeatlas'

defineProps<{
  steps: WorkspaceSetupStep[]
  savedWorkspaceCount: number
  lastSavedAt: string
}>()

defineEmits<{
  action: [id: string]
}>()

const statusClass: Record<WorkspaceSetupStep['status'], string> = {
  done: 'border-emerald-100 bg-emerald-50 text-atlas-success',
  active: 'border-atlas-accent/30 bg-atlas-rail text-atlas-accent',
  pending: 'border-atlas-border bg-white text-atlas-muted'
}
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex flex-col gap-3 border-b border-atlas-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="ui-title text-base">Workspace setup</h2>
        <p class="mt-1 text-xs leading-5 text-atlas-muted">A saved analysis workspace with AI context, reports, and review state.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <span class="ui-span rounded-atlas border border-atlas-border bg-white px-2.5 py-1 text-xs font-semibold text-atlas-muted">
          {{ savedWorkspaceCount }} saved
        </span>
        <span class="ui-span rounded-atlas border border-atlas-border bg-white px-2.5 py-1 text-xs font-semibold text-atlas-muted">
          {{ lastSavedAt }}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 divide-y divide-atlas-line lg:grid-cols-4 lg:divide-x lg:divide-y-0">
      <article v-for="step in steps" :key="step.id" class="min-w-0 px-4 py-4">
        <div class="flex items-start gap-3">
          <span class="ui-span mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold" :class="statusClass[step.status]">
            {{ step.status === 'done' ? 'OK' : step.status === 'active' ? '>' : '-' }}
          </span>
          <div class="min-w-0">
            <h3 class="ui-title text-sm leading-5">{{ step.label }}</h3>
            <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ step.detail }}</p>
          </div>
        </div>
        <button
          type="button"
          class="ui-button mt-3 h-8 w-full justify-center border-atlas-border bg-white px-3 text-xs text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
          @click="$emit('action', step.id)"
        >
          <span class="ui-span">{{ step.action }}</span>
        </button>
      </article>
    </div>
  </section>
</template>
