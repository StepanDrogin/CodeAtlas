<script setup lang="ts">
import type { NavSection } from '~/types/codeatlas'

interface ActivityLogItem {
  id: number
  label: string
  detail: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  timestamp: string
}

const question = defineModel<string>('question', { required: true })

defineProps<{
  isAsking?: boolean
  activityLog: ActivityLogItem[]
  activeSectionLabel: string
  isDemoMode: boolean
  repositoryName: string
}>()

const emit = defineEmits<{
  ask: []
  'focus-command': []
  'new-analysis': []
  'open-section': [section: NavSection]
}>()

const commandInput = ref<HTMLInputElement | null>(null)
const activePanel = ref<'actions' | 'activity' | 'workspace' | null>(null)

const quickActions: Array<{ label: string; section: NavSection; badge: string }> = [
  {
    label: 'Ask CodeAtlas',
    section: 'ask',
    badge: 'Ask'
  },
  {
    label: 'PR Review',
    section: 'pr-review',
    badge: 'PR'
  },
  {
    label: 'Reports',
    section: 'reports',
    badge: 'Pack'
  }
]

const toneClass: Record<ActivityLogItem['tone'], string> = {
  info: 'bg-atlas-info',
  success: 'bg-atlas-success',
  warning: 'bg-atlas-warning',
  danger: 'bg-atlas-danger'
}

const togglePanel = (panel: 'actions' | 'activity' | 'workspace') => {
  activePanel.value = activePanel.value === panel ? null : panel
}

const closePanel = () => {
  activePanel.value = null
}

const focusCommand = () => {
  commandInput.value?.focus()
  activePanel.value = null
  emit('focus-command')
}

const openSection = (section: NavSection) => {
  activePanel.value = null
  emit('open-section', section)
}

const startNewAnalysis = () => {
  activePanel.value = null
  emit('new-analysis')
}

const handleKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    focusCommand()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <header class="sticky top-0 z-20 flex flex-col items-stretch gap-3 border-b border-atlas-border bg-atlas-surface/95 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
    <form class="relative w-full max-w-[760px]" :aria-busy="isAsking" @submit.prevent="$emit('ask')">
      <svg aria-hidden="true" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-atlas-muted" viewBox="0 0 24 24" fill="none">
        <path d="m21 21-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <input
        ref="commandInput"
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

    <div class="relative flex items-center justify-between gap-2 md:ml-6 md:justify-end">
      <button
        type="button"
        class="ui-button h-9 w-9 border-atlas-border bg-white text-atlas-muted hover:text-atlas-ink"
        aria-label="Quick actions"
        :aria-expanded="activePanel === 'actions'"
        @click="togglePanel('actions')"
      >
        <span class="ui-span text-sm">/</span>
      </button>
      <button
        type="button"
        class="ui-button h-9 border-atlas-border bg-white px-3 text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
        aria-label="New analysis"
        @click="startNewAnalysis"
      >
        <span class="ui-span text-lg leading-none">+</span>
        <span class="ui-span hidden sm:inline">New analysis</span>
      </button>
      <button
        type="button"
        class="ui-button relative h-9 w-9 border-atlas-border bg-white text-atlas-muted hover:text-atlas-ink"
        aria-label="Activity log"
        :aria-expanded="activePanel === 'activity'"
        @click="togglePanel('activity')"
      >
        <span class="ui-span">!</span>
        <span v-if="activityLog.length" class="ui-span absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-atlas-accent ring-2 ring-white"></span>
      </button>
      <button
        type="button"
        class="ui-button h-9 w-9 rounded-full border-atlas-border bg-atlas-canvas p-0 text-xs font-semibold text-atlas-ink shadow-insetLine hover:border-atlas-accent hover:text-atlas-accent"
        aria-label="Workspace menu"
        :aria-expanded="activePanel === 'workspace'"
        @click="togglePanel('workspace')"
      >
        <span class="ui-span">
        SK
        </span>
      </button>

      <Transition name="atlas-popover">
        <section
          v-if="activePanel === 'actions'"
          class="atlas-panel absolute right-0 top-12 z-30 w-[min(360px,calc(100vw-2rem))] overflow-hidden"
        >
          <div class="border-b border-atlas-line px-4 py-3">
            <h2 class="ui-title text-base">Quick actions</h2>
          </div>
          <div class="space-y-2 p-3">
            <button
              type="button"
              class="ui-button w-full justify-between border-atlas-border bg-white px-3 py-2 text-left text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
              aria-label="Focus command"
              @click="focusCommand"
            >
              <span class="ui-span min-w-0">
                <span class="ui-span block text-sm font-semibold">Focus command</span>
              </span>
              <span class="ui-span rounded border border-atlas-border bg-atlas-canvas px-2 py-0.5 text-xs text-atlas-muted">Ctrl K</span>
            </button>
            <button
              v-for="action in quickActions"
              :key="action.label"
              type="button"
              class="ui-button w-full justify-between border-atlas-border bg-white px-3 py-2 text-left text-atlas-ink hover:border-atlas-accent hover:text-atlas-accent"
              :aria-label="`Open ${action.label}`"
              @click="openSection(action.section)"
            >
              <span class="ui-span min-w-0">
                <span class="ui-span block text-sm font-semibold">{{ action.label }}</span>
              </span>
              <span class="ui-span rounded border border-atlas-border bg-atlas-canvas px-2 py-0.5 text-xs text-atlas-muted">{{ action.badge }}</span>
            </button>
          </div>
        </section>
      </Transition>

      <Transition name="atlas-popover">
        <section
          v-if="activePanel === 'activity'"
          class="atlas-panel absolute right-0 top-12 z-30 w-[min(360px,calc(100vw-2rem))] overflow-hidden"
        >
          <div class="flex items-center justify-between gap-3 border-b border-atlas-line px-4 py-3">
            <h2 class="ui-title text-base">Activity</h2>
            <button type="button" class="ui-button h-8 border-atlas-border bg-white px-2 text-xs text-atlas-muted hover:text-atlas-ink" @click="closePanel">
              <span class="ui-span">Close</span>
            </button>
          </div>
          <div v-if="activityLog.length" class="max-h-[320px] divide-y divide-atlas-line overflow-auto">
            <article v-for="entry in activityLog" :key="entry.id" class="flex gap-3 px-4 py-3">
              <span class="ui-span mt-1 h-2.5 w-2.5 shrink-0 rounded-full" :class="toneClass[entry.tone]"></span>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="ui-span truncate text-sm font-semibold text-atlas-ink">{{ entry.label }}</span>
                  <span class="ui-span text-xs text-atlas-muted">{{ entry.timestamp }}</span>
                </div>
                <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ entry.detail }}</p>
              </div>
            </article>
          </div>
          <div v-else class="px-4 py-6 text-sm leading-6 text-atlas-muted">
            No activity yet. Run analysis, ask Gemini, or review a pull request to fill this log.
          </div>
        </section>
      </Transition>

      <Transition name="atlas-popover">
        <section
          v-if="activePanel === 'workspace'"
          class="atlas-panel absolute right-0 top-12 z-30 w-[min(320px,calc(100vw-2rem))] overflow-hidden"
        >
          <div class="border-b border-atlas-line px-4 py-3">
            <h2 class="ui-title text-base">Workspace</h2>
          </div>
          <div class="divide-y divide-atlas-line">
            <div class="flex items-center justify-between gap-3 px-4 py-3">
              <span class="ui-span text-sm text-atlas-muted">Repository</span>
              <span class="ui-span truncate text-sm font-semibold text-atlas-ink">{{ repositoryName }}</span>
            </div>
            <div class="flex items-center justify-between gap-3 px-4 py-3">
              <span class="ui-span text-sm text-atlas-muted">Section</span>
              <span class="ui-span truncate text-sm font-semibold text-atlas-ink">{{ activeSectionLabel }}</span>
            </div>
            <div class="flex items-center justify-between gap-3 px-4 py-3">
              <span class="ui-span text-sm text-atlas-muted">Mode</span>
              <span class="ui-span rounded bg-atlas-rail px-2 py-1 text-xs font-semibold text-atlas-accent">{{ isDemoMode ? 'Demo' : 'Live API' }}</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 p-3">
            <button type="button" class="ui-button h-9 border-atlas-border bg-white px-3 text-atlas-ink hover:text-atlas-accent" aria-label="Open workspace settings" @click="openSection('settings')">
              <span class="ui-span">Settings</span>
            </button>
            <button type="button" class="ui-button h-9 border-atlas-border bg-white px-3 text-atlas-ink hover:text-atlas-accent" aria-label="Open workspace integrations" @click="openSection('integrations')">
              <span class="ui-span">Integrations</span>
            </button>
          </div>
        </section>
      </Transition>
    </div>
  </header>
</template>
