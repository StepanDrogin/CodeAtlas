<script setup lang="ts">
import type { RecentAnalysis } from '~/types/codeatlas'

defineProps<{
  analyses: RecentAnalysis[]
  activeRepository: string
}>()

defineEmits<{
  select: [repository: string]
}>()
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex items-center justify-between gap-3 border-b border-atlas-line px-4 py-3">
      <div>
        <h2 class="ui-title text-base">Recent analyses</h2>
        <p class="mt-1 text-xs text-atlas-muted">Local workspace memory for quick re-runs.</p>
      </div>
      <span class="ui-span rounded-full bg-atlas-canvas px-2 py-0.5 text-xs font-semibold text-atlas-muted">{{ analyses.length }}</span>
    </div>

    <div v-if="analyses.length" class="divide-y divide-atlas-line">
      <button
        v-for="analysis in analyses"
        :key="analysis.id"
        type="button"
        class="ui-button w-full justify-between rounded-none px-4 py-3 text-left hover:bg-atlas-canvas"
        :class="analysis.repository === activeRepository ? 'bg-atlas-rail/70' : ''"
        @click="$emit('select', analysis.repository)"
      >
        <span class="ui-span min-w-0">
          <span class="ui-span block truncate text-sm font-semibold text-atlas-ink">{{ analysis.repository }}</span>
          <span class="ui-span mt-1 block line-clamp-1 text-xs text-atlas-muted">{{ analysis.description }}</span>
          <span class="ui-span mt-2 block text-xs text-atlas-subtle">{{ analysis.meta }} - {{ analysis.analyzedAt }}</span>
        </span>
        <span class="ui-span ml-3 flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full bg-white text-sm font-semibold text-atlas-accent shadow-insetLine">
          <span class="ui-span block leading-none">{{ analysis.score }}</span>
          <span class="ui-span mt-0.5 block text-[9px] font-semibold uppercase text-atlas-muted">{{ analysis.healthLabel }}</span>
        </span>
      </button>
    </div>

    <div v-else class="px-4 py-8 text-sm leading-6 text-atlas-muted">
      Run a repository analysis and CodeAtlas will keep it here for this browser.
    </div>
  </section>
</template>
