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
        class="ui-button w-full justify-between rounded-none px-4 py-3 text-left hover:bg-atlas-canvas/80"
        :class="analysis.repository === activeRepository ? 'bg-atlas-rail/70' : ''"
        @click="$emit('select', analysis.repository)"
      >
        <span class="ui-span flex min-w-0 items-center gap-3">
          <span class="ui-span grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-atlas-ink shadow-insetLine">
            <span class="ui-span text-xs font-semibold">GH</span>
          </span>
          <span class="ui-span min-w-0">
            <span class="ui-span block truncate text-sm font-semibold text-atlas-ink">{{ analysis.repository }}</span>
            <span class="ui-span mt-1 block truncate text-xs text-atlas-muted">main - {{ analysis.analyzedAt }}</span>
          </span>
        </span>
        <span class="ui-span ml-3 inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-atlas-muted">
          <span class="ui-span h-2 w-2 rounded-full" :class="analysis.score >= 80 ? 'bg-atlas-success' : analysis.score >= 68 ? 'bg-atlas-warning' : 'bg-atlas-danger'"></span>
          {{ analysis.score }}
        </span>
      </button>
    </div>

    <div v-else class="px-4 py-8 text-sm leading-6 text-atlas-muted">
      Run a repository analysis and CodeAtlas will keep it here for this browser.
    </div>
  </section>
</template>
