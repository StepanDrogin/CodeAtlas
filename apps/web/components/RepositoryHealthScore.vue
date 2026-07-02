<script setup lang="ts">
import type { HealthSegment } from '~/types/codeatlas'

const props = defineProps<{
  score: number
  label: string
  repositoryName: string
  segments: HealthSegment[]
}>()

const ringStyle = computed(() => ({
  background: `conic-gradient(#007f78 ${Math.max(0, Math.min(props.score, 100)) * 3.6}deg, #b8eee9 ${Math.max(0, Math.min(props.score, 100)) * 3.6 + 36}deg, #e7eef5 0deg)`
}))

const toneClass: Record<HealthSegment['tone'], string> = {
  good: 'bg-emerald-50 text-atlas-success',
  watch: 'bg-amber-50 text-amber-700',
  risk: 'bg-red-50 text-atlas-danger'
}

const barClass: Record<HealthSegment['tone'], string> = {
  good: 'bg-atlas-success',
  watch: 'bg-atlas-warning',
  risk: 'bg-atlas-danger'
}
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="border-b border-atlas-line px-4 py-3">
      <h2 class="ui-title text-base">Repository health</h2>
      <p class="mt-1 truncate text-xs text-atlas-muted">{{ repositoryName }}</p>
    </div>

    <div class="grid gap-5 p-5 md:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[180px_minmax(0,1fr)]">
      <div class="flex items-center justify-center">
        <div class="relative grid h-40 w-40 place-items-center rounded-full p-3 shadow-instrument" :style="ringStyle">
          <div class="grid h-full w-full place-items-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(216,226,236,.9)]">
            <div class="text-center">
              <span class="ui-span block text-[42px] font-semibold leading-none text-atlas-ink">{{ score }}</span>
              <span class="ui-span mt-1 block text-sm text-atlas-muted">/100</span>
              <span class="ui-span mt-2 inline-flex rounded-full bg-atlas-rail px-2.5 py-1 text-[11px] font-semibold uppercase text-atlas-accent">{{ label }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="divide-y divide-atlas-line">
        <article v-for="segment in segments" :key="segment.label" class="py-3 first:pt-0 last:pb-0">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="ui-title text-sm leading-5">{{ segment.label }}</h3>
              <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ segment.detail }}</p>
            </div>
            <span class="ui-span rounded px-2 py-1 text-xs font-semibold" :class="toneClass[segment.tone]">{{ segment.value }}</span>
          </div>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-atlas-canvas">
            <div class="h-full rounded-full transition-all duration-500" :class="barClass[segment.tone]" :style="{ width: `${segment.score}%` }"></div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
