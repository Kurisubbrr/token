<template>
  <component v-if="ready && enabled" :is="serviceView" />
  <AppLayout v-else>
    <SubscriptionCatalog v-if="showSubscriptionCatalog">
      <template #actions>
        <RouterLink to="/orders" class="btn btn-secondary">{{ t('userService.orderQuery') }}</RouterLink>
      </template>
    </SubscriptionCatalog>
    <div v-else-if="!ready && !loadFailed" class="flex justify-center py-12" role="status">
      <span class="text-gray-500 dark:text-dark-400">{{ t('common.loading') }}</span>
    </div>
    <div v-else class="card p-8">
      <EmptyState
        :title="t(loadFailed ? 'userService.loadFailed' : 'userService.unavailable')"
        :description="t(loadFailed ? 'userService.retryHint' : 'userService.unavailableHint')"
      >
        <template #action>
          <button v-if="loadFailed" class="btn btn-primary" @click="loadSettings">{{ t('common.tryAgain') }}</button>
          <RouterLink v-if="feature === 'payment'" to="/orders" class="btn btn-secondary">
            {{ t('userService.orderQuery') }}
          </RouterLink>
        </template>
      </EmptyState>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SubscriptionCatalog from '@/components/payment/SubscriptionCatalog.vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { FeatureFlags, resolveFeatureFlag } from '@/utils/featureFlags'

const props = defineProps<{ feature: 'payment' | 'subscription' | 'affiliate' | 'redeem' }>()
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const loadFailed = ref(false)
const unavailableInSimpleMode = computed(() => authStore.isSimpleMode && ['subscription', 'redeem'].includes(props.feature))
const ready = computed(() => props.feature === 'redeem' || unavailableInSimpleMode.value || appStore.publicSettingsLoaded)
const enabled = computed(() => {
  if (unavailableInSimpleMode.value) return false
  if (props.feature === 'redeem') return true
  return resolveFeatureFlag(appStore.cachedPublicSettings, FeatureFlags[props.feature])
})
const serviceViews = {
  payment: defineAsyncComponent(() => import('./PaymentView.vue').then(module => module.default)),
  subscription: defineAsyncComponent(() => import('./SubscriptionsView.vue').then(module => module.default)),
  affiliate: defineAsyncComponent(() => import('./AffiliateView.vue').then(module => module.default)),
  redeem: defineAsyncComponent(() => import('./RedeemView.vue').then(module => module.default)),
}
const serviceView = computed(() => serviceViews[props.feature])
const showSubscriptionCatalog = computed(() =>
  props.feature === 'payment'
  && ready.value
  && !loadFailed.value
  && appStore.cachedPublicSettings?.payment_enabled === false
)


async function loadSettings() {
  loadFailed.value = false
  try {
    await appStore.fetchPublicSettings()
  } catch {
    // Keep the service view unmounted until its availability is known.
  }
  loadFailed.value = !appStore.publicSettingsLoaded
}

watch(() => props.feature, () => {
  if (!ready.value) void loadSettings()
}, { immediate: true })
</script>
