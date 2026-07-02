<script setup lang="ts">
import type { AnalysisStep } from '~/types/codeatlas'

const props = defineProps<{
  steps: AnalysisStep[]
  isBusy: boolean
  updatedAt: string
}>()

const completedCount = computed(() => props.steps.filter((step) => step.status === 'complete').length)
const progressWidth = computed(() => `${Math.round((completedCount.value / Math.max(props.steps.length, 1)) * 100)}%`)

const dotClass: Record<AnalysisStep['status'], string> = {
  complete: 'border-atlas-success bg-atlas-success text-white',
  active: 'border-atlas-accent bg-atlas-accent text-white shadow-[0_0_0_6px_rgba(0,122,104,0.12)]',
  pending: 'border-atlas-border bg-white text-atlas-subtle',
  failed: 'border-atlas-danger bg-atlas-danger text-white'
}

const rowClass: Record<AnalysisStep['status'], string> = {
  complete: 'border-atlas-line bg-white',
  active: 'border-atlas-accent/40 bg-atlas-rail/70',
  pending: 'border-atlas-line bg-white/70',
  failed: 'border-red-100 bg-red-50'
}

const stepDurations = ['2m 14s', '3m 21s', '4m 07s', '1m 12s', '45s']
const { t } = useCodeAtlasI18n()
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex items-center justify-between gap-3 border-b border-atlas-line px-4 py-3">
      <div>
        <h2 class="ui-title text-base">{{ t('timeline.title') }}</h2>
        <p class="mt-1 text-xs text-atlas-muted">{{ updatedAt }}</p>
      </div>
      <span
        class="ui-span inline-flex items-center gap-2 rounded-atlas border px-2.5 py-1 text-xs font-semibold"
        :class="isBusy ? 'border-atlas-warning bg-amber-50 text-amber-700' : 'border-emerald-100 bg-emerald-50 text-atlas-success'"
      >
        <span class="ui-span h-1.5 w-1.5 rounded-full" :class="isBusy ? 'animate-pulse bg-atlas-warning' : 'bg-atlas-success'"></span>
        {{ isBusy ? t('timeline.running') : t('timeline.ready') }}
      </span>
    </div>

    <div class="p-5">
      <div class="relative overflow-x-auto pb-2">
        <div class="absolute left-7 right-7 top-[15px] h-0.5 bg-atlas-border"></div>
        <div class="absolute left-7 top-[15px] h-0.5 bg-atlas-accent transition-all duration-500" :style="{ width: progressWidth }"></div>
        <div class="relative grid min-w-[560px] grid-cols-5 gap-3 md:gap-4">
          <article
            v-for="(step, index) in steps"
            :key="step.id"
            class="min-w-0"
          >
            <span class="ui-span relative z-10 mx-auto grid h-8 w-8 place-items-center rounded-full border text-xs font-bold" :class="dotClass[step.status]">
              <span v-if="step.status === 'active'" class="ui-span h-3 w-3 animate-spin rounded-full border-2 border-white/35 border-t-white"></span>
              <span v-else class="ui-span">{{ step.status === 'complete' ? 'OK' : step.status === 'failed' ? '!' : index + 1 }}</span>
            </span>
            <div class="mt-3 text-center">
              <h3 class="ui-title truncate text-sm">{{ step.label }}</h3>
              <p class="mt-1 text-xs text-atlas-muted">{{ stepDurations[index] }}</p>
            </div>
          </article>
        </div>
      </div>

      <div
        v-for="step in steps.filter((item) => item.status === 'active').slice(0, 1)"
        :key="step.id"
        class="mt-4 flex items-center gap-3 rounded-atlas border px-3 py-3"
        :class="rowClass[step.status]"
      >
        <span class="ui-span text-atlas-violet">*</span>
        <p class="text-sm leading-5 text-atlas-muted">{{ step.detail }}</p>
      </div>
      <div v-if="!isBusy" class="mt-4 flex items-center gap-3 rounded-atlas border border-atlas-line bg-atlas-canvas px-3 py-3">
        <span class="ui-span h-2 w-2 rounded-full bg-atlas-success"></span>
        <p class="text-sm leading-5 text-atlas-muted">{{ t('timeline.readyDetail') }}</p>
      </div>
    </div>
  </section>
</template>
