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

const { t } = useCodeAtlasI18n()
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex items-center justify-between gap-3 border-b border-atlas-line px-4 py-3">
      <div>
        <h2 class="ui-title text-base">{{ t('insights.title') }}</h2>
        <p class="mt-1 text-xs text-atlas-muted">{{ t('insights.detail') }}</p>
      </div>
      <span class="ui-span rounded-atlas border border-atlas-border bg-white px-2.5 py-1 text-xs font-semibold text-atlas-muted">{{ t('insights.badge') }}</span>
    </div>

    <div class="divide-y divide-atlas-line">
      <article v-for="insight in insights" :key="insight.id" class="group px-4 py-3 transition hover:bg-atlas-canvas/70">
        <div class="grid gap-3 md:grid-cols-[20px_120px_minmax(0,1fr)_auto] md:items-center">
          <span class="ui-span mt-1 h-2.5 w-2.5 shrink-0 rounded-full md:mt-0" :class="dotClass[insight.tone]"></span>
          <span class="ui-span min-w-0">
            <span class="ui-span block text-xs font-semibold uppercase text-atlas-muted">{{ insight.tone }}</span>
            <span class="ui-span mt-1 block text-sm font-semibold text-atlas-ink">{{ insight.label.split(' ')[0] }}</span>
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="ui-title text-sm">{{ insight.label }}</h3>
            <p class="mt-1 text-sm leading-5 text-atlas-muted">{{ insight.detail }}</p>
          </div>
          <div class="flex items-center gap-2 md:justify-end">
            <span class="ui-span w-fit rounded border px-2 py-1 text-xs font-semibold" :class="toneClass[insight.tone]">
              {{ insight.tone === 'risk' ? t('common.risk') : insight.tone === 'warning' ? t('common.medium') : t('common.info') }}
            </span>
            <button
              v-if="insight.section && insight.action"
              type="button"
              class="ui-button h-8 border-atlas-border bg-white px-3 text-xs text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
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
