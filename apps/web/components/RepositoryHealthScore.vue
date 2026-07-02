<script setup lang="ts">
import type { HealthSegment } from '~/types/codeatlas'

const props = defineProps<{
  score: number
  label: string
  repositoryName: string
  segments: HealthSegment[]
}>()

const ringStyle = computed(() => ({
  background: `conic-gradient(#007a68 ${Math.max(0, Math.min(props.score, 100)) * 3.6}deg, #e7edf3 0deg)`
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

    <div class="grid gap-4 p-4 md:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[170px_minmax(0,1fr)]">
      <div class="flex items-center justify-center">
        <div class="relative grid h-36 w-36 place-items-center rounded-full p-2 shadow-insetLine" :style="ringStyle">
          <div class="grid h-full w-full place-items-center rounded-full bg-white shadow-atlas">
            <div class="text-center">
              <span class="ui-span block text-4xl font-semibold text-atlas-ink">{{ score }}</span>
              <span class="ui-span mt-1 block text-xs font-semibold uppercase text-atlas-muted">{{ label }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-3">
        <article v-for="segment in segments" :key="segment.label" class="rounded-atlas border border-atlas-line bg-white px-3 py-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="ui-title text-sm">{{ segment.label }}</h3>
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
