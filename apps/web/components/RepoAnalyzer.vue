<script setup lang="ts">
const repoUrl = defineModel<string>('repoUrl', { required: true })

defineProps<{
  isAnalyzing: boolean
  lastAnalyzedAt: string
  analysisError?: string
}>()

defineEmits<{
  analyze: []
  'view-report': []
}>()
</script>

<template>
  <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,520px)]">
    <div>
      <h2 class="ui-title mb-3 text-2xl">Repository</h2>
      <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="$emit('analyze')">
        <label class="sr-only" for="repo-url">GitHub repository URL</label>
        <div class="relative flex-1">
          <svg aria-hidden="true" class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-atlas-ink" viewBox="0 0 24 24" fill="currentColor">
            <path fill-rule="evenodd" d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.41-4.04-1.41-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.24 1.84 1.24 1.08 1.84 2.82 1.31 3.51 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.49 11.49 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" clip-rule="evenodd" />
          </svg>
          <input
            id="repo-url"
            v-model="repoUrl"
            class="atlas-control h-12 w-full border-atlas-accent pl-12 pr-4 text-base shadow-insetLine"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="github.com/org/repo"
          >
        </div>
        <button
          type="submit"
          class="ui-button h-12 w-full bg-atlas-accent px-5 text-white shadow-atlas hover:bg-atlas-accentDark sm:w-auto sm:min-w-[180px]"
          :disabled="isAnalyzing"
          :aria-busy="isAnalyzing"
        >
          <span v-if="isAnalyzing" class="ui-span h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
          <span class="ui-span">{{ isAnalyzing ? 'Analyzing...' : 'Analyze repository' }}</span>
        </button>
      </form>
    </div>

    <div class="atlas-panel flex items-center justify-between px-5 py-4" :aria-busy="isAnalyzing">
      <div class="flex items-center gap-3">
        <span
          class="ui-span grid h-9 w-9 place-items-center rounded-full text-white transition"
          :class="analysisError ? 'bg-atlas-danger' : isAnalyzing ? 'bg-atlas-warning' : 'bg-atlas-success'"
        >
          <span v-if="isAnalyzing" class="ui-span h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
          <span v-else class="ui-span">{{ analysisError ? '!' : 'OK' }}</span>
        </span>
        <div>
          <p class="text-sm font-semibold text-atlas-ink">{{ analysisError ? 'Analysis failed' : isAnalyzing ? 'Analysis running' : 'Analysis complete' }}</p>
          <p class="text-xs text-atlas-muted">{{ analysisError || (isAnalyzing ? 'Indexing repository graph and references' : lastAnalyzedAt) }}</p>
        </div>
      </div>
      <button
        type="button"
        class="ui-button h-9 whitespace-nowrap border-atlas-border bg-white px-3 text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
        @click="$emit('view-report')"
      >
        <span class="ui-span">View report</span>
      </button>
    </div>
  </section>
</template>
