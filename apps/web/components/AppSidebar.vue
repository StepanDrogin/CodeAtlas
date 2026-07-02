<script setup lang="ts">
import type { NavItem, NavSection } from '~/types/codeatlas'

defineProps<{
  activeSection: NavSection
  navItems: NavItem[]
}>()

defineEmits<{
  'change-section': [section: NavSection]
}>()
</script>

<template>
  <aside class="flex w-full shrink-0 flex-col border-b border-atlas-border bg-atlas-surface px-3 py-4 lg:min-h-screen lg:w-[228px] lg:border-b-0 lg:border-r">
    <div class="mb-4 flex items-center gap-3 px-2 lg:mb-7">
      <div class="grid h-9 w-9 place-items-center rounded-atlas bg-atlas-accent text-white shadow-sm">
        <svg aria-hidden="true" class="h-6 w-6" viewBox="0 0 24 24" fill="none">
          <path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" fill="currentColor" opacity=".95" />
          <path d="m4 12 8 4.5 8-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="m4 16.5 8 4.5 8-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <h1 class="ui-title text-xl">CodeAtlas</h1>
    </div>

    <nav class="flex gap-1 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
      <button
        v-for="item in navItems"
        :key="item.id"
        type="button"
        class="ui-button relative h-10 shrink-0 justify-start px-3 text-atlas-muted hover:bg-atlas-rail hover:text-atlas-accent lg:w-full"
        :class="item.id === activeSection ? 'bg-atlas-rail text-atlas-accent shadow-insetLine' : ''"
        @click="$emit('change-section', item.id)"
      >
        <span
          class="ui-span absolute left-0 h-5 w-1 rounded-r-full bg-atlas-accent transition"
          :class="item.id === activeSection ? 'opacity-100' : 'opacity-0'"
        ></span>
        <span class="ui-span grid h-5 w-5 place-items-center text-current">
          <AppIcon :name="item.icon" class="h-4 w-4" />
        </span>
        <span class="ui-span truncate">{{ item.label }}</span>
      </button>
    </nav>

    <div class="mt-6 hidden border-t border-atlas-line pt-4 lg:block">
      <div class="mb-3 flex items-center gap-3 rounded-atlas border border-atlas-border bg-atlas-canvas p-3">
        <span class="ui-span grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-semibold text-atlas-accent shadow-insetLine">
          AC
        </span>
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-atlas-ink">Acme Corp</p>
          <p class="truncate text-xs text-atlas-muted">Enterprise workspace</p>
        </div>
      </div>
      <button type="button" class="ui-button h-9 w-full justify-start border-atlas-border bg-white px-3 text-atlas-muted hover:text-atlas-ink">
        <span class="ui-span text-base leading-none">&lt;</span>
        <span class="ui-span">Collapse</span>
      </button>
    </div>
  </aside>
</template>
