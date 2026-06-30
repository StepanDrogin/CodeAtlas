<script setup lang="ts">
defineProps<{
  name: string
}>()
</script>

<template>
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <g v-if="name === 'repository'">
      <path d="M5 6.5h14v11H5z" />
      <path d="M8 10h8" />
      <path d="M8 14h5" />
    </g>
    <g v-else-if="name === 'architecture'">
      <path d="M6 7h4v4H6zM14 13h4v4h-4zM14 3h4v4h-4z" />
      <path d="M10 9h2c1.1 0 2-.9 2-2M10 9h2c1.1 0 2 .9 2 2v2" />
    </g>
    <g v-else-if="name === 'ask'">
      <path d="M5 6.5A6.5 6.5 0 0 1 11.5 3h1A6.5 6.5 0 0 1 19 9.5v.5a6.5 6.5 0 0 1-6.5 6.5H11l-4 3v-4.2A6.48 6.48 0 0 1 5 10z" />
      <path d="M10.5 8.7a2 2 0 0 1 3.3 1.5c0 1.5-1.8 1.8-1.8 3" />
      <path d="M12 15.8h.01" />
    </g>
    <g v-else-if="name === 'review'">
      <path d="m8 9-3 3 3 3" />
      <path d="m16 9 3 3-3 3" />
      <path d="m13 7-2 10" />
    </g>
    <g v-else-if="name === 'observability'">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-4" />
      <path d="M12 16V8" />
      <path d="M16 16v-6" />
    </g>
    <g v-else-if="name === 'bookmarks'">
      <path d="M7 4h10v16l-5-3-5 3z" />
    </g>
    <g v-else-if="name === 'reports'">
      <path d="M7 3.5h7l3 3V20H7z" />
      <path d="M14 3.5v3h3" />
      <path d="M9.5 11h5" />
      <path d="M9.5 15h5" />
    </g>
    <g v-else-if="name === 'integrations'">
      <path d="M8 12a4 4 0 0 1 4-4h2" />
      <path d="M16 12a4 4 0 0 1-4 4h-2" />
      <path d="M7 8h2v8H7zM15 8h2v8h-2z" />
    </g>
    <g v-else>
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
      <path d="M12 3.5v2M12 18.5v2M4.6 7l1.7 1M17.7 16l1.7 1M4.6 17l1.7-1M17.7 8l1.7-1" />
    </g>
  </svg>
</template>
