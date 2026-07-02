<script setup lang="ts">
import type { AiSessionItem } from '~/types/codeatlas'

defineProps<{
  items: AiSessionItem[]
  suggestions: string[]
  isAsking: boolean
}>()

defineEmits<{
  ask: [question: string]
  select: [item: AiSessionItem]
  clear: []
}>()

const modeClass: Record<AiSessionItem['mode'], string> = {
  gemini: 'bg-atlas-rail text-atlas-accent',
  fallback: 'bg-amber-50 text-amber-700',
  demo: 'bg-blue-50 text-blue-700'
}
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex flex-col gap-3 border-b border-atlas-line px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 class="ui-title text-base">AI session</h3>
        <p class="mt-1 text-xs leading-5 text-atlas-muted">
          Follow-up prompts, answer history, and reusable source-grounded context.
        </p>
      </div>
      <button
        type="button"
        class="ui-button h-8 border-atlas-border bg-white px-3 text-xs text-atlas-muted hover:text-atlas-danger disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!items.length"
        @click="$emit('clear')"
      >
        <span class="ui-span">Clear history</span>
      </button>
    </div>

    <div class="border-b border-atlas-line bg-atlas-canvas/70 px-4 py-4">
      <p class="atlas-muted-label">Suggested follow-ups</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion"
          type="button"
          class="ui-button min-h-9 border-atlas-border bg-white px-3 py-2 text-left text-xs leading-5 text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
          :disabled="isAsking"
          @click="$emit('ask', suggestion)"
        >
          <span class="ui-span">{{ suggestion }}</span>
        </button>
      </div>
    </div>

    <div v-if="items.length" class="max-h-[460px] divide-y divide-atlas-line overflow-auto">
      <article v-for="item in items" :key="item.id" class="px-4 py-3">
        <button
          type="button"
          class="ui-button w-full items-start justify-start rounded-none border-0 bg-transparent p-0 text-left hover:bg-transparent"
          @click="$emit('select', item)"
        >
          <span class="ui-span min-w-0 flex-1">
            <span class="ui-span flex flex-wrap items-center gap-2">
              <span class="ui-span rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.02em]" :class="modeClass[item.mode]">
                {{ item.mode }}
              </span>
              <span class="ui-span text-xs text-atlas-muted">{{ item.askedAt }}</span>
              <span class="ui-span rounded border border-atlas-border bg-atlas-canvas px-2 py-0.5 text-xs text-atlas-muted">
                {{ item.confidence }}%
              </span>
            </span>
            <span class="ui-span mt-2 block text-sm font-semibold leading-5 text-atlas-ink">{{ item.question }}</span>
            <span class="ui-span mt-1 line-clamp-2 block text-xs leading-5 text-atlas-muted">{{ item.answer }}</span>
            <span class="ui-span mt-2 flex flex-wrap gap-1.5">
              <span
                v-for="reference in item.references.slice(0, 3)"
                :key="`${item.id}-${reference.file}`"
                class="ui-span max-w-full truncate rounded border border-atlas-border bg-white px-2 py-0.5 text-[11px] text-atlas-muted"
              >
                {{ reference.file }}
              </span>
            </span>
          </span>
        </button>
      </article>
    </div>

    <div v-else class="px-4 py-6 text-sm leading-6 text-atlas-muted">
      Ask the first question to create a reusable AI session trail for this repository.
    </div>
  </section>
</template>
