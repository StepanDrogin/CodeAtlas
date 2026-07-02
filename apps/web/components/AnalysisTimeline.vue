<script setup lang="ts">
import type { AnalysisStep } from '~/types/codeatlas'

const props = defineProps<{
  steps: AnalysisStep[]
  isBusy: boolean
  updatedAt: string
}>()

const completedCount = computed(() => props.steps.filter((step) => step.status === 'complete').length)
const progressWidth = computed(() => `${Math.round((completedCount.value / Math.max(props.steps.length, 1)) * 100)}%`)

const dotClass: Record<AnalysisStep['status'], string> = {
  complete: 'border-atlas-success bg-atlas-success text-white',
  active: 'border-atlas-accent bg-atlas-accent text-white shadow-[0_0_0_6px_rgba(0,122,104,0.12)]',
  pending: 'border-atlas-border bg-white text-atlas-subtle',
  failed: 'border-atlas-danger bg-atlas-danger text-white'
}

const rowClass: Record<AnalysisStep['status'], string> = {
  complete: 'border-atlas-line bg-white',
  active: 'border-atlas-accent/40 bg-atlas-rail/70',
  pending: 'border-atlas-line bg-white/70',
  failed: 'border-red-100 bg-red-50'
}
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex items-center justify-between gap-3 border-b border-atlas-line px-4 py-3">
      <div>
        <h2 class="ui-title text-base">Analysis timeline</h2>
        <p class="mt-1 text-xs text-atlas-muted">{{ updatedAt }}</p>
      </div>
      <span
        class="ui-span inline-flex items-center gap-2 rounded-atlas border px-2.5 py-1 text-xs font-semibold"
        :class="isBusy ? 'border-atlas-warning bg-amber-50 text-amber-700' : 'border-emerald-100 bg-emerald-50 text-atlas-success'"
      >
        <span class="ui-span h-1.5 w-1.5 rounded-full" :class="isBusy ? 'animate-pulse bg-atlas-warning' : 'bg-atlas-success'"></span>
        {{ isBusy ? 'Running' : 'Ready' }}
      </span>
    </div>

    <div class="border-b border-atlas-line bg-atlas-canvas px-4 py-3">
      <div class="h-2 overflow-hidden rounded-full bg-white shadow-insetLine">
        <div class="h-full rounded-full bg-atlas-accent transition-all duration-500 ease-out" :style="{ width: progressWidth }"></div>
      </div>
    </div>

    <div class="space-y-2 p-3">
      <article
        v-for="(step, index) in steps"
        :key="step.id"
        class="flex gap-3 rounded-atlas border px-3 py-3 transition duration-200"
        :class="rowClass[step.status]"
      >
        <span class="ui-span grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold" :class="dotClass[step.status]">
          <span v-if="step.status === 'active'" class="ui-span h-3 w-3 animate-spin rounded-full border-2 border-white/35 border-t-white"></span>
          <span v-else class="ui-span">{{ step.status === 'complete' ? 'OK' : step.status === 'failed' ? '!' : index + 1 }}</span>
        </span>
        <div class="min-w-0">
          <h3 class="ui-title text-sm">{{ step.label }}</h3>
          <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ step.detail }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
