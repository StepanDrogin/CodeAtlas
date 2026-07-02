<script setup lang="ts">
import type { PullRequest, PullRequestReview, RiskLevel } from '~/types/codeatlas'

const reviewUrl = defineModel<string>('reviewUrl', { required: true })

defineProps<{
  pullRequests: PullRequest[]
  riskSignals: string[]
  review: PullRequestReview
  isReviewing: boolean
  reviewError?: string
}>()

defineEmits<{
  review: []
}>()

const activeTab = ref<'prs' | 'signals'>('prs')
const { t } = useCodeAtlasI18n()

const riskClass: Record<RiskLevel, string> = {
  High: 'bg-red-50 text-atlas-danger',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-emerald-50 text-emerald-700'
}

const selectPullRequest = (pullRequest: PullRequest) => {
  if (pullRequest.url) {
    reviewUrl.value = pullRequest.url
  }
}
</script>

<template>
  <section class="atlas-panel overflow-hidden">
    <div class="flex items-center border-b border-atlas-line">
      <button
        type="button"
        class="ui-button h-11 rounded-none border-b-2 px-4 text-sm"
        :class="activeTab === 'prs' ? 'border-atlas-accent text-atlas-accent' : 'border-transparent text-atlas-muted hover:text-atlas-ink'"
        @click="activeTab = 'prs'"
      >
        <span class="ui-span">{{ t('pr.review') }}</span>
      </button>
      <button
        type="button"
        class="ui-button h-11 rounded-none border-b-2 px-4 text-sm"
        :class="activeTab === 'signals' ? 'border-atlas-accent text-atlas-accent' : 'border-transparent text-atlas-muted hover:text-atlas-ink'"
        @click="activeTab = 'signals'"
      >
        <span class="ui-span">{{ t('pr.riskSignals') }}</span>
      </button>
    </div>

    <div v-if="activeTab === 'prs'" class="p-4">
      <form class="mb-4 flex flex-col gap-2 lg:flex-row" :aria-busy="isReviewing" @submit.prevent="$emit('review')">
        <label class="sr-only" for="pr-url">{{ t('pr.urlLabel') }}</label>
        <input
          id="pr-url"
          v-model="reviewUrl"
          class="atlas-control min-w-0 flex-1"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="github.com/org/repo/pull/123"
        >
        <button
          type="submit"
          class="ui-button h-10 bg-atlas-ink px-4 text-white hover:bg-atlas-accent"
          :disabled="isReviewing"
          :aria-busy="isReviewing"
        >
          <span v-if="isReviewing" class="ui-span h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
          <span class="ui-span">{{ isReviewing ? t('pr.reviewing') : t('pr.reviewCta') }}</span>
        </button>
      </form>

      <div v-if="reviewError" class="mb-4 rounded-atlas border border-red-100 bg-red-50 px-3 py-2 text-sm text-atlas-danger">
        {{ reviewError }}
      </div>

      <div class="mb-5 border-b border-atlas-line pb-4">
        <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase text-atlas-muted">{{ t('pr.currentReview') }}</p>
            <h2 class="ui-title mt-1 line-clamp-2 text-base">{{ review.title }}</h2>
            <p class="mt-1 text-xs text-atlas-muted">{{ t('pr.byAuthor', { repository: review.repositoryFullName, id: review.id, author: review.author }) }}</p>
          </div>
          <span class="ui-span rounded px-2 py-1 text-xs font-semibold" :class="riskClass[review.risk]">{{ review.risk }}</span>
        </div>

        <p class="text-sm leading-5 text-atlas-ink">{{ review.summary }}</p>

        <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div class="border-l border-atlas-line pl-3">
            <span class="ui-span block text-atlas-muted">{{ t('common.files') }}</span>
            <span class="ui-span font-semibold text-atlas-ink">{{ review.changedFiles }}</span>
          </div>
          <div class="border-l border-atlas-line pl-3">
            <span class="ui-span block text-atlas-muted">{{ t('common.additions') }}</span>
            <span class="ui-span font-semibold text-atlas-ink">+{{ review.additions }}</span>
          </div>
          <div class="border-l border-atlas-line pl-3">
            <span class="ui-span block text-atlas-muted">{{ t('common.deletions') }}</span>
            <span class="ui-span font-semibold text-atlas-ink">-{{ review.deletions }}</span>
          </div>
        </div>
      </div>

      <div class="mb-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 class="ui-title mb-2 text-sm">{{ t('pr.affectedModules') }}</h3>
          <div class="space-y-2">
            <div v-for="module in review.affectedModules" :key="module.name" class="border-b border-atlas-line pb-2 last:border-0 last:pb-0">
              <div class="flex items-center justify-between gap-3">
                <span class="ui-span text-sm font-semibold text-atlas-ink">{{ module.name }}</span>
                <span class="ui-span rounded px-2 py-0.5 text-xs font-semibold" :class="riskClass[module.risk]">{{ module.risk }}</span>
              </div>
              <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ module.reason }}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 class="ui-title mb-2 text-sm">{{ t('pr.suggestedComments') }}</h3>
          <div class="space-y-2">
            <div v-for="comment in review.suggestedComments" :key="`${comment.file}-${comment.message}`" class="border-b border-atlas-line pb-2 last:border-0 last:pb-0">
              <div class="flex items-center gap-2">
                <span class="ui-span rounded px-2 py-0.5 text-xs font-semibold" :class="riskClass[comment.severity]">{{ comment.severity }}</span>
                <span class="ui-span truncate text-xs font-semibold text-violet-700">{{ comment.file }}</span>
              </div>
              <p class="mt-1 text-xs leading-5 text-atlas-ink">{{ comment.message }}</p>
              <p class="mt-1 text-xs leading-5 text-atlas-muted">{{ comment.rationale }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="mb-5 grid gap-3 md:grid-cols-3">
        <div>
          <h3 class="ui-title mb-2 text-sm">{{ t('pr.missingTests') }}</h3>
          <p v-if="!review.missingTests.length" class="text-xs text-atlas-muted">{{ t('pr.noMissingTests') }}</p>
          <ul v-else class="space-y-2">
            <li v-for="finding in review.missingTests" :key="finding" class="text-xs leading-5 text-atlas-muted">{{ finding }}</li>
          </ul>
        </div>
        <div>
          <h3 class="ui-title mb-2 text-sm">{{ t('pr.security') }}</h3>
          <p v-if="!review.securityConcerns.length" class="text-xs text-atlas-muted">{{ t('pr.noSecurity') }}</p>
          <ul v-else class="space-y-2">
            <li v-for="finding in review.securityConcerns" :key="finding" class="text-xs leading-5 text-atlas-muted">{{ finding }}</li>
          </ul>
        </div>
        <div>
          <h3 class="ui-title mb-2 text-sm">{{ t('pr.breakingChanges') }}</h3>
          <p v-if="!review.breakingChanges.length" class="text-xs text-atlas-muted">{{ t('pr.noBreaking') }}</p>
          <ul v-else class="space-y-2">
            <li v-for="finding in review.breakingChanges" :key="finding" class="text-xs leading-5 text-atlas-muted">{{ finding }}</li>
          </ul>
        </div>
      </div>

      <div class="mb-3 flex items-center gap-2">
        <h2 class="ui-title text-base">{{ t('pr.openPullRequests') }}</h2>
        <span class="ui-span rounded-full bg-atlas-canvas px-2 py-0.5 text-xs font-semibold text-atlas-muted">{{ pullRequests.length }}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[460px] text-left text-sm">
          <thead class="text-xs font-medium text-atlas-muted">
            <tr>
              <th class="border-b border-atlas-line py-2 font-medium">PR</th>
              <th class="border-b border-atlas-line py-2 font-medium">{{ t('pr.title') }}</th>
              <th class="border-b border-atlas-line py-2 font-medium">{{ t('common.files') }}</th>
              <th class="border-b border-atlas-line py-2 font-medium">{{ t('common.risk') }}</th>
              <th class="border-b border-atlas-line py-2 font-medium">{{ t('pr.checks') }}</th>
            </tr>
          </thead>
          <tbody v-if="pullRequests.length">
            <tr v-for="pullRequest in pullRequests" :key="pullRequest.id" class="border-b border-atlas-line last:border-0">
              <td class="py-2 font-semibold text-violet-700">
                <button
                  type="button"
                  class="ui-button h-7 justify-start px-0 text-violet-700 hover:text-atlas-accent"
                  @click="selectPullRequest(pullRequest)"
                >
                  <span class="ui-span">{{ pullRequest.id }}</span>
                </button>
              </td>
              <td class="max-w-[240px] truncate py-2 text-atlas-ink">{{ pullRequest.title }}</td>
              <td class="py-2 text-atlas-muted">{{ pullRequest.changedFiles }}</td>
              <td class="py-2">
                <span class="ui-span rounded px-2 py-1 text-xs font-semibold" :class="riskClass[pullRequest.risk]">{{ pullRequest.risk }}</span>
              </td>
              <td class="py-2 text-atlas-muted">{{ pullRequest.checks }}</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="5" class="py-8 text-center text-sm text-atlas-muted">
                {{ t('pr.noOpen') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="space-y-3 p-4">
      <h2 class="ui-title text-base">{{ t('pr.riskSignals') }}</h2>
      <div v-for="signal in riskSignals" :key="signal" class="rounded-atlas border border-atlas-border bg-atlas-canvas p-3 text-sm leading-5 text-atlas-ink">
        {{ signal }}
      </div>
    </div>
  </section>
</template>
