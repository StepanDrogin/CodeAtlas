<script setup lang="ts">
const repoUrl = defineModel<string>('repoUrl', { required: true })

const props = defineProps<{
  isAnalyzing: boolean
  lastAnalyzedAt: string
  analysisError?: string
}>()

defineEmits<{
  analyze: []
  'view-report': []
}>()

const { t } = useCodeAtlasI18n()
const displayRepository = computed(() => repoUrl.value.replace(/^https?:\/\//, '').replace(/^github\.com\//, '') || 'github.com/org/repo')
const statusLabel = computed(() => {
  if (props.analysisError) {
    return t('repository.needsAttention')
  }

  return props.isAnalyzing ? t('repository.analyzing') : t('common.analyzed')
})
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <h2 class="ui-title sr-only">{{ t('repository.command') }}</h2>
    <div class="grid gap-3 p-3 2xl:grid-cols-[minmax(0,1fr)_auto_minmax(360px,520px)] 2xl:items-center">
      <form class="flex min-w-0 flex-col gap-3 sm:flex-row" @submit.prevent="$emit('analyze')">
        <label class="sr-only" for="repo-url">{{ t('repository.urlLabel') }}</label>
        <div class="relative flex-1">
          <svg aria-hidden="true" class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-atlas-ink" viewBox="0 0 24 24" fill="currentColor">
            <path fill-rule="evenodd" d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.41-4.04-1.41-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.24 1.84 1.24 1.08 1.84 2.82 1.31 3.51 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.49 11.49 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" clip-rule="evenodd" />
          </svg>
          <input
            id="repo-url"
            v-model="repoUrl"
            class="atlas-control h-14 w-full border-atlas-border bg-white pl-12 pr-4 text-base font-semibold shadow-insetLine focus:border-atlas-accent"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="github.com/org/repo"
          >
        </div>
        <button
          type="submit"
          class="ui-button h-14 w-full bg-atlas-accent px-6 text-white shadow-instrument hover:bg-atlas-accentDark sm:w-auto sm:min-w-[190px]"
          :disabled="isAnalyzing"
          :aria-busy="isAnalyzing"
        >
          <span v-if="isAnalyzing" class="ui-span h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
          <span class="ui-span">{{ isAnalyzing ? t('repository.analyzingCta') : t('repository.analyzeCta') }}</span>
        </button>
      </form>

      <div class="hidden h-10 w-px bg-atlas-line 2xl:block"></div>

      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="ui-span grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white transition"
            :class="analysisError ? 'bg-atlas-danger' : isAnalyzing ? 'bg-atlas-warning' : 'bg-atlas-success'"
          >
            <span v-if="isAnalyzing" class="ui-span h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
            <span v-else class="ui-span">{{ analysisError ? '!' : 'OK' }}</span>
          </span>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate text-sm font-semibold text-atlas-ink">{{ statusLabel }}</p>
              <span class="ui-span h-1.5 w-1.5 rounded-full bg-atlas-cyan"></span>
              <span class="ui-span rounded bg-atlas-rail px-2 py-0.5 text-xs font-semibold text-atlas-accent">main</span>
            </div>
            <p class="mt-1 truncate text-xs text-atlas-muted">{{ analysisError || lastAnalyzedAt }}</p>
            <p class="mt-1 truncate text-xs text-atlas-subtle">{{ displayRepository }}</p>
          </div>
        </div>
        <button
          type="button"
          class="ui-button h-10 whitespace-nowrap border-atlas-border bg-white px-4 text-atlas-ink shadow-sm hover:border-atlas-accent hover:text-atlas-accent"
          @click="$emit('view-report')"
        >
          <span class="ui-span">{{ t('repository.viewReport') }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
