<script setup lang="ts">
import type { SourceReference, SummaryItem } from '~/types/codeatlas'

const props = withDefaults(defineProps<{
  summaryItems: SummaryItem[]
  answer: string
  references?: SourceReference[]
  contextReferences?: SourceReference[]
  confidence?: number
  question?: string
}>(), {
  references: () => [],
  contextReferences: () => [],
  confidence: 82,
  question: ''
})

const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
const answerRating = ref<'useful' | 'not-useful' | null>(null)
const copyTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const { t } = useCodeAtlasI18n()

const toneClass: Record<SummaryItem['tone'], string> = {
  neutral: 'text-atlas-info',
  good: 'text-atlas-success',
  risk: 'text-atlas-danger',
  opportunity: 'text-atlas-accent'
}

const evidenceReferences = computed(() => props.references.slice(0, 3))
const contextReferences = computed(() => (props.contextReferences.length ? props.contextReferences : evidenceReferences.value).slice(0, 4))
const confidenceLabel = computed(() => t('ai.confidence', { value: Math.max(0, Math.min(Math.round(props.confidence), 100)) }))
const nextSteps = computed(() => {
  const risk = props.summaryItems.find((item) => item.tone === 'risk')
  const opportunity = props.summaryItems.find((item) => item.tone === 'opportunity')

  return [
    risk ? t('ai.verifyPrefix', { text: risk.text }) : t('ai.verifyFallback'),
    opportunity ? t('ai.improvePrefix', { text: opportunity.text }) : t('ai.improveFallback'),
    t('ai.openPrFallback')
  ]
})

const copyAnswer = async () => {
  try {
    await navigator.clipboard.writeText(props.answer)
    copyState.value = 'copied'
  } catch {
    copyState.value = 'failed'
  }

  if (copyTimer.value) {
    clearTimeout(copyTimer.value)
  }

  copyTimer.value = setTimeout(() => {
    copyState.value = 'idle'
  }, 1800)
}

onBeforeUnmount(() => {
  if (copyTimer.value) {
    clearTimeout(copyTimer.value)
  }
})
</script>

<template>
  <section class="atlas-panel flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-atlas-line px-4 py-3">
      <div class="flex items-center gap-3">
        <h2 class="ui-title text-base">{{ t('ai.summary') }}</h2>
        <span class="ui-span rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-atlas-violet">{{ t('ai.grounded') }}</span>
      </div>
      <button
        type="button"
        class="ui-button h-8 border-atlas-border bg-white px-3 text-xs text-atlas-muted hover:text-atlas-ink"
        :class="copyState === 'copied' ? 'border-atlas-success text-atlas-success' : copyState === 'failed' ? 'border-atlas-danger text-atlas-danger' : ''"
        @click="copyAnswer"
      >
        <span class="ui-span">{{ copyState === 'copied' ? t('common.copied') : copyState === 'failed' ? t('common.retry') : t('common.copy') }}</span>
      </button>
    </div>
    <div class="flex flex-1 flex-col gap-4 px-4 py-4">
      <div class="rounded-atlas border border-atlas-line bg-atlas-canvas/80 px-4 py-4">
        <div v-if="question" class="mb-3 rounded-atlas border border-atlas-border bg-white px-3 py-2 text-xs leading-5 text-atlas-muted">
          <span class="ui-span font-semibold text-atlas-ink">{{ t('ai.question') }}</span>
          {{ question }}
        </div>
        <p class="text-sm leading-6 text-atlas-ink">
          {{ answer }}
        </p>
      </div>
      <div v-if="contextReferences.length" class="rounded-atlas border border-atlas-line bg-white">
        <div class="flex items-center justify-between border-b border-atlas-line px-3 py-2">
          <h3 class="ui-title text-sm">{{ t('ai.contextUsed') }}</h3>
          <span class="ui-span rounded bg-atlas-rail px-2 py-0.5 text-xs font-semibold text-atlas-accent">{{ confidenceLabel }}</span>
        </div>
        <div class="divide-y divide-atlas-line">
          <article v-for="reference in contextReferences" :key="`context-${reference.file}`" class="flex items-start justify-between gap-3 px-3 py-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-atlas-ink">{{ reference.file }}</p>
              <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ reference.service }} - {{ reference.description }}</p>
            </div>
            <span class="ui-span shrink-0 rounded border border-atlas-border bg-atlas-canvas px-2 py-0.5 text-xs text-atlas-muted">{{ reference.loc }} LOC</span>
          </article>
        </div>
      </div>
      <div class="space-y-3">
        <div v-for="item in summaryItems" :key="item.label" class="flex gap-3">
          <span class="ui-span mt-1 grid h-5 w-5 shrink-0 place-items-center rounded border border-current/25 text-xs font-bold" :class="toneClass[item.tone]">
            -
          </span>
          <p class="text-sm leading-5 text-atlas-muted">
            <strong class="font-semibold text-atlas-ink">{{ item.label }}:</strong>
            {{ item.text }}
          </p>
        </div>
      </div>
      <div v-if="evidenceReferences.length" class="rounded-atlas border border-atlas-line bg-white">
        <div class="flex items-center justify-between border-b border-atlas-line px-3 py-2">
          <h3 class="ui-title text-sm">{{ t('ai.groundedSources') }}</h3>
          <span class="ui-span text-xs text-atlas-muted">{{ t('ai.referencesCount', { count: evidenceReferences.length }) }}</span>
        </div>
        <div class="divide-y divide-atlas-line">
          <article v-for="reference in evidenceReferences" :key="reference.file" class="px-3 py-2">
            <div class="flex items-start justify-between gap-3">
              <p class="truncate text-sm font-semibold text-atlas-ink">{{ reference.file }}</p>
              <span class="ui-span shrink-0 rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{{ reference.type }}</span>
            </div>
            <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ reference.description }}</p>
          </article>
        </div>
      </div>
      <div class="rounded-atlas border border-atlas-line bg-white px-3 py-3">
        <h3 class="ui-title text-sm">{{ t('ai.topRecommendations') }}</h3>
        <div class="mt-3 space-y-2">
          <div v-for="step in nextSteps" :key="step" class="flex gap-2 text-xs leading-5 text-atlas-muted">
            <span class="ui-span mt-0.5 text-atlas-success">OK</span>
            <p>{{ step }}</p>
          </div>
        </div>
      </div>
      <div class="mt-auto flex items-center justify-between pt-2 text-xs text-atlas-muted">
        <span class="ui-span">{{ t('ai.generatedBy') }}</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="ui-button h-8 w-8 border-atlas-border bg-white text-atlas-muted hover:text-atlas-accent"
            :class="answerRating === 'useful' ? 'border-atlas-accent bg-atlas-rail text-atlas-accent' : ''"
            :aria-label="t('ai.markUseful')"
            :aria-pressed="answerRating === 'useful'"
            @click="answerRating = answerRating === 'useful' ? null : 'useful'"
          >
            <span class="ui-span">+</span>
          </button>
          <button
            type="button"
            class="ui-button h-8 w-8 border-atlas-border bg-white text-atlas-muted hover:text-atlas-danger"
            :class="answerRating === 'not-useful' ? 'border-atlas-danger bg-red-50 text-atlas-danger' : ''"
            :aria-label="t('ai.markNotUseful')"
            :aria-pressed="answerRating === 'not-useful'"
            @click="answerRating = answerRating === 'not-useful' ? null : 'not-useful'"
          >
            <span class="ui-span">-</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
