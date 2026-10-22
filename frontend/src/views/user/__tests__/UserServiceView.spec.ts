import { flushPromises, mount } from '@vue/test-utils'
import { h, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserServiceView from '../UserServiceView.vue'

const appStore = reactive({
  publicSettingsLoaded: true,
  cachedPublicSettings: {} as Record<string, boolean>,
  fetchPublicSettings: vi.fn(),
})
const authStore = reactive({ isSimpleMode: false })

vi.mock('@/stores/app', () => ({ useAppStore: () => appStore }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStore }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('../PaymentView.vue', () => ({ default: { render: () => h('div', { 'data-testid': 'payment' }) } }))
vi.mock('../SubscriptionsView.vue', () => ({ default: { render: () => h('div', { 'data-testid': 'subscription' }) } }))
vi.mock('../AffiliateView.vue', () => ({ default: { render: () => h('div', { 'data-testid': 'affiliate' }) } }))
vi.mock('../RedeemView.vue', () => ({ default: { render: () => h('div', { 'data-testid': 'redeem' }) } }))

function mountService(feature: 'payment' | 'subscription' | 'affiliate' | 'redeem') {
  return mount(UserServiceView, {
    props: { feature },
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        SubscriptionCatalog: { template: '<section data-testid="subscription-catalog"><slot name="actions" /></section>' },
        Icon: true,
        RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
}

describe('user services with fixed navigation', () => {
  beforeEach(() => {
    authStore.isSimpleMode = false
    appStore.publicSettingsLoaded = true
    appStore.cachedPublicSettings = {}
    appStore.fetchPublicSettings.mockReset()
  })

  it.each(['subscription', 'redeem'] as const)(
    'keeps the %s menu usable in simple mode without mounting its business actions', async (feature) => {
      authStore.isSimpleMode = true
      appStore.publicSettingsLoaded = false
      const wrapper = mountService(feature)
      await flushPromises()
      expect(wrapper.text()).toContain('userService.unavailable')
      expect(wrapper.find('[data-testid]').exists()).toBe(false)
      expect(appStore.fetchPublicSettings).not.toHaveBeenCalled()
      wrapper.unmount()
    },
  )

  it('renders redemption normally without waiting for unrelated public flags', async () => {
    appStore.publicSettingsLoaded = false
    const wrapper = mountService('redeem')
    await flushPromises()
    expect(wrapper.find('[data-testid="redeem"]').exists()).toBe(true)
    expect(appStore.fetchPublicSettings).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['payment', 'affiliate'] as const)(
    'loads availability when a reused redemption view changes to %s', async (feature) => {
      appStore.publicSettingsLoaded = false
      const wrapper = mountService('redeem')
      await flushPromises()
      expect(appStore.fetchPublicSettings).not.toHaveBeenCalled()
      appStore.fetchPublicSettings.mockImplementation(async () => {
        appStore.publicSettingsLoaded = true
        appStore.cachedPublicSettings = { [`${feature}_enabled`]: false }
      })
      await wrapper.setProps({ feature })
      await flushPromises()
      expect(appStore.fetchPublicSettings).toHaveBeenCalledOnce()
      expect(wrapper.find('[data-testid="' + feature + '"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="subscription-catalog"]').exists()).toBe(feature === 'payment')
      if (feature === 'affiliate') expect(wrapper.text()).toContain('userService.unavailable')
      wrapper.unmount()
    },
  )

  it.each(['payment', 'subscription', 'affiliate'] as const)(
    'shows an unavailable message for disabled %s without mounting its service', async (feature) => {
      appStore.cachedPublicSettings = { [`${feature}_enabled`]: false }
      const wrapper = mountService(feature)
      await flushPromises()
      if (feature === 'payment') {
        expect(wrapper.find('[data-testid="subscription-catalog"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="payment"]').exists()).toBe(false)
      } else {
        expect(wrapper.text()).toContain('userService.unavailable')
        expect(wrapper.text()).toContain('userService.unavailableHint')
        expect(wrapper.find('[data-testid]').exists()).toBe(false)
      }
      expect(wrapper.find('a[href="/orders"]').exists()).toBe(feature === 'payment')
      wrapper.unmount()
    },
  )

  it.each(['payment', 'subscription', 'affiliate'] as const)(
    'renders enabled %s normally', async (feature) => {
      appStore.cachedPublicSettings = { [`${feature}_enabled`]: true }
      const wrapper = mountService(feature)
      await flushPromises()
      expect(wrapper.find(`[data-testid="${feature}"]`).exists()).toBe(true)
      expect(wrapper.text()).not.toContain('userService.unavailable')
      wrapper.unmount()
    },
  )

  it('shows loading until public settings determine availability', async () => {
    appStore.publicSettingsLoaded = false
    let finish!: () => void
    appStore.fetchPublicSettings.mockImplementation(() => new Promise<void>((resolve) => {
      finish = () => {
        appStore.publicSettingsLoaded = true
        appStore.cachedPublicSettings = { payment_enabled: false }
        resolve()
      }
    }))
    const wrapper = mountService('payment')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid]').exists()).toBe(false)
    finish()
    await flushPromises()
    expect(wrapper.find('[data-testid="subscription-catalog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payment"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('lets a failed settings request be retried without exposing payment actions', async () => {
    appStore.publicSettingsLoaded = false
    appStore.fetchPublicSettings.mockResolvedValueOnce(null).mockImplementationOnce(async () => {
      appStore.publicSettingsLoaded = true
      appStore.cachedPublicSettings = { payment_enabled: true }
    })
    const wrapper = mountService('payment')
    await flushPromises()
    expect(wrapper.text()).toContain('userService.loadFailed')
    expect(wrapper.find('[data-testid]').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="payment"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('preserves the existing payment path when the loaded payment flag is absent', async () => {
    appStore.cachedPublicSettings = {}
    const wrapper = mountService('payment')
    await flushPromises()
    expect(wrapper.find('[data-testid="payment"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="subscription-catalog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps a failed load retryable even when a stale payment flag is false', async () => {
    appStore.publicSettingsLoaded = false
    appStore.cachedPublicSettings = { payment_enabled: false }
    appStore.fetchPublicSettings.mockRejectedValue(new Error('settings unavailable'))
    const wrapper = mountService('payment')
    await flushPromises()
    expect(wrapper.text()).toContain('userService.loadFailed')
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('[data-testid="subscription-catalog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="payment"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('returns to the real payment view if the payment flag becomes enabled', async () => {
    appStore.cachedPublicSettings = { payment_enabled: false }
    const wrapper = mountService('payment')
    await flushPromises()
    expect(wrapper.find('[data-testid="subscription-catalog"]').exists()).toBe(true)
    appStore.cachedPublicSettings = { payment_enabled: true }
    await flushPromises()
    expect(wrapper.find('[data-testid="subscription-catalog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="payment"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
