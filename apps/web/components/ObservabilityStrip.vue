<script setup lang="ts">
import type { Metric } from '~/types/codeatlas'

defineProps<{
  metrics: Metric[]
}>()

const range = ref('7D')

const sparklinePath = (points: number[]) => {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const width = 160
  const height = 42
  const step = width / Math.max(points.length - 1, 1)

  return points
    .map((point, index) => {
      const normalized = max === min ? 0.5 : (point - min) / (max - min)
      const x = index * step
      const y = height - normalized * (height - 8) - 4

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex items-center justify-between border-b border-atlas-line px-4 py-3">
      <div class="flex items-center gap-3">
        <h2 class="ui-title text-base">Observability</h2>
        <select v-model="range" class="atlas-control h-8 w-20 text-xs" aria-label="Metric range">
          <option>7D</option>
          <option>14D</option>
          <option>30D</option>
        </select>
      </div>
      <button type="button" class="ui-button h-8 text-atlas-accent hover:text-atlas-accentDark">
        <span class="ui-span">View all metrics</span>
        <span class="ui-span">&gt;</span>
      </button>
    </div>

    <div class="grid grid-cols-1 divide-y divide-atlas-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-6">
      <div v-for="metric in metrics" :key="metric.label" class="px-4 py-4">
        <p class="text-xs font-medium text-atlas-muted">{{ metric.label }}</p>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="ui-span text-2xl font-semibold text-atlas-ink">{{ metric.value }}</span>
          <span
            class="ui-span text-xs font-semibold"
            :class="metric.tone === 'good' ? 'text-atlas-success' : 'text-atlas-danger'"
          >
            {{ metric.trend === 'down' ? 'v' : '^' }} {{ metric.delta }}
          </span>
        </div>
        <svg aria-hidden="true" class="mt-3 h-11 w-full" viewBox="0 0 160 42" preserveAspectRatio="none">
          <path
            :d="sparklinePath(metric.points)"
            fill="none"
            :stroke="metric.tone === 'good' ? '#007a68' : '#d92d20'"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>
  </section>
</template>
