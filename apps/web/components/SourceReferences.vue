<script setup lang="ts">
import type { SourceReference } from '~/types/codeatlas'

const props = defineProps<{
  references: SourceReference[]
}>()

const search = ref('')
const activeType = ref('All')

const filterTypes = computed(() => ['All', ...Array.from(new Set(props.references.map((reference) => reference.type)))])

const filteredReferences = computed(() => {
  const query = search.value.trim().toLowerCase()

  return props.references.filter((reference) => {
    const matchesType = activeType.value === 'All' || reference.type === activeType.value
    const matchesQuery =
      !query ||
      reference.file.toLowerCase().includes(query) ||
      reference.service.toLowerCase().includes(query) ||
      reference.description.toLowerCase().includes(query)

    return matchesType && matchesQuery
  })
})
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex flex-col gap-3 border-b border-atlas-line px-4 py-3 md:flex-row md:items-center md:justify-between">
      <h2 class="ui-title text-base">Source references</h2>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="type in filterTypes"
          :key="type"
          type="button"
          class="ui-button h-8 px-3 text-xs"
          :class="activeType === type ? 'bg-atlas-rail text-atlas-accent' : 'border-atlas-border bg-white text-atlas-muted hover:text-atlas-ink'"
          @click="activeType = type"
        >
          <span class="ui-span">{{ type }}</span>
        </button>
        <input v-model="search" class="atlas-control h-8 w-full text-xs sm:w-44" type="search" placeholder="Search files...">
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead class="bg-atlas-canvas text-xs font-medium text-atlas-muted">
          <tr>
            <th class="border-b border-atlas-line px-4 py-2 font-medium">File</th>
            <th class="border-b border-atlas-line px-2 py-2 font-medium">Type</th>
            <th class="border-b border-atlas-line px-2 py-2 font-medium">Service</th>
            <th class="border-b border-atlas-line px-2 py-2 font-medium">Description</th>
            <th class="border-b border-atlas-line px-2 py-2 font-medium">LOC</th>
            <th class="border-b border-atlas-line px-2 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="reference in filteredReferences" :key="reference.file" class="border-b border-atlas-line last:border-0 hover:bg-atlas-canvas/70">
            <td class="max-w-[220px] truncate px-4 py-2 font-medium text-atlas-ink">{{ reference.file }}</td>
            <td class="px-2 py-2">
              <span class="ui-span rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{{ reference.type }}</span>
            </td>
            <td class="px-2 py-2 text-atlas-muted">{{ reference.service }}</td>
            <td class="px-2 py-2 text-atlas-muted">{{ reference.description }}</td>
            <td class="px-2 py-2 text-atlas-muted">{{ reference.loc }}</td>
            <td class="px-2 py-2 text-atlas-muted">{{ reference.updated }}</td>
          </tr>
          <tr v-if="!filteredReferences.length">
            <td colspan="6" class="px-4 py-8 text-center text-sm text-atlas-muted">
              No source references match this filter.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between border-t border-atlas-line px-4 py-3">
      <span class="ui-span text-sm text-atlas-muted">Showing {{ filteredReferences.length }} of {{ references.length }} indexed references</span>
      <button type="button" class="ui-button h-8 text-atlas-accent hover:text-atlas-accentDark">
        <span class="ui-span">View all files</span>
        <span class="ui-span">&gt;</span>
      </button>
    </div>
  </section>
</template>
