<script setup lang="ts">
import type { InsightItem, NavSection } from '~/types/codeatlas'

defineProps<{
  insights: InsightItem[]
}>()

defineEmits<{
  open: [section: NavSection]
}>()

const toneClass: Record<InsightItem['tone'], string> = {
  good: 'border-emerald-100 bg-emerald-50 text-atlas-success',
  info: 'border-blue-100 bg-blue-50 text-atlas-info',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  risk: 'border-red-100 bg-red-50 text-atlas-danger'
}

const dotClass: Record<InsightItem['tone'], string> = {
  good: 'bg-atlas-success',
  info: 'bg-atlas-info',
  warning: 'bg-atlas-warning',
  risk: 'bg-atlas-danger'
}
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex items-center justify-between gap-3 border-b border-atlas-line px-4 py-3">
      <div>
        <h2 class="ui-title text-base">Insight feed</h2>
        <p class="mt-1 text-xs text-atlas-muted">Live-style findings from the current repository context.</p>
      </div>
      <span class="ui-span rounded-full bg-atlas-canvas px-2 py-0.5 text-xs font-semibold text-atlas-muted">{{ insights.length }}</span>
    </div>

    <div class="divide-y divide-atlas-line">
      <article v-for="insight in insights" :key="insight.id" class="group px-4 py-3 transition hover:bg-atlas-canvas/70">
        <div class="flex items-start gap-3">
          <span class="ui-span mt-1 h-2.5 w-2.5 shrink-0 rounded-full" :class="dotClass[insight.tone]"></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <h3 class="ui-title text-sm">{{ insight.label }}</h3>
                <p class="mt-1 text-sm leading-5 text-atlas-muted">{{ insight.detail }}</p>
              </div>
              <span class="ui-span w-fit rounded border px-2 py-1 text-xs font-semibold" :class="toneClass[insight.tone]">
                {{ insight.tone }}
              </span>
            </div>
            <button
              v-if="insight.section && insight.action"
              type="button"
              class="ui-button mt-3 h-8 border-atlas-border bg-white px-3 text-xs text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
              @click="$emit('open', insight.section)"
            >
              <span class="ui-span">{{ insight.action }}</span>
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
