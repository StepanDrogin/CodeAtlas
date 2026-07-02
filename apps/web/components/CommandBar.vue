<script setup lang="ts">
const question = defineModel<string>('question', { required: true })

defineProps<{
  isAsking?: boolean
}>()

defineEmits<{
  ask: []
  'new-analysis': []
  'show-shortcuts': []
  'show-notifications': []
}>()
</script>

<template>
  <header class="sticky top-0 z-20 flex flex-col items-stretch gap-3 border-b border-atlas-border bg-atlas-surface/95 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
    <form class="relative w-full max-w-[760px]" :aria-busy="isAsking" @submit.prevent="$emit('ask')">
      <svg aria-hidden="true" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-atlas-muted" viewBox="0 0 24 24" fill="none">
        <path d="m21 21-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <input
        v-model="question"
        class="atlas-control w-full pl-9 pr-16"
        type="search"
        aria-label="Ask CodeAtlas"
        placeholder="Ask CodeAtlas..."
      >
      <span
        class="ui-span absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded border border-atlas-border bg-atlas-canvas px-2 py-0.5 text-xs text-atlas-muted"
        :class="isAsking ? 'border-atlas-accent text-atlas-accent' : ''"
      >
        <span v-if="isAsking" class="ui-span h-1.5 w-1.5 animate-pulse rounded-full bg-atlas-accent"></span>
        {{ isAsking ? 'Asking' : 'Ctrl K' }}
      </span>
    </form>

    <div class="flex items-center justify-between gap-2 md:ml-6 md:justify-end">
      <button
        type="button"
        class="ui-button h-9 w-9 border-atlas-border bg-white text-atlas-muted hover:text-atlas-ink"
        aria-label="Keyboard shortcuts"
        @click="$emit('show-shortcuts')"
      >
        <span class="ui-span text-sm">/</span>
      </button>
      <button
        type="button"
        class="ui-button h-9 border-atlas-border bg-white px-3 text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
        @click="$emit('new-analysis')"
      >
        <span class="ui-span text-lg leading-none">+</span>
        <span class="ui-span hidden sm:inline">New analysis</span>
      </button>
      <button
        type="button"
        class="ui-button h-9 w-9 border-atlas-border bg-white text-atlas-muted hover:text-atlas-ink"
        aria-label="Notifications"
        @click="$emit('show-notifications')"
      >
        <span class="ui-span">!</span>
      </button>
      <span class="ui-span grid h-9 w-9 place-items-center rounded-full bg-atlas-canvas text-xs font-semibold text-atlas-ink shadow-insetLine">
        SK
      </span>
    </div>
  </header>
</template>
