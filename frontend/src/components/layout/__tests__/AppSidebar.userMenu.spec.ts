import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import AppSidebar from '../AppSidebar.vue'
import { useAuthStore, useAppStore } from '@/stores'

const state = vi.hoisted(() => ({
  app: {
    sidebarCollapsed: false,
    mobileOpen: false,
    sidebarScrollTop: 0,
    backendModeEnabled: false,
    publicSettingsLoaded: true,
    siteName: 'token',
    siteLogo: '',
    siteVersion: '',
    cachedPublicSettings: {} as Record<string, unknown>,
    toggleSidebar: vi.fn(),
    setMobileOpen: vi.fn(),
  },
  auth: {
    user: { role: 'user' as 'user' | 'admin' | 'super_admin' },
    get isAdmin() { return this.user.role === 'admin' || this.user.role === 'super_admin' },
    get isSuperAdmin() { return this.user.role === 'super_admin' },
    isSimpleMode: false,
  },
  admin: {
    opsMonitoringEnabled: true,
    paymentEnabled: true,
    customMenuItems: [],
    fetch: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/stores', async () => {
  const { reactive } = await import('vue')
  const app = reactive(state.app)
  const auth = reactive(state.auth)
  return {
    useAppStore: () => app,
    useAuthStore: () => auth,
    useAdminSettingsStore: () => state.admin,
    useOnboardingStore: () => ({ isCurrentStep: () => false, nextStep: vi.fn() }),
  }
})
vi.mock('@/stores/app', async () => {
  const { reactive } = await import('vue')
  return { useAppStore: () => reactive(state.app) }
})
vi.mock('@/composables/useBatchImageAccess', async () => {
  const { ref } = await import('vue')
  return { useBatchImageAccess: () => ({ canUseBatchImage: ref(true), refreshBatchImageAccess: vi.fn() }) }
})
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/dashboard' }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string) => key === 'nav.rechargeCenterNoFee' ? '充值中心（无手续费）' : key,
  }),
}))

const expectedUserPaths = [
  '/dashboard', '/keys', '/usage', '/subscriptions', '/redeem', '/affiliate', '/profile', '/purchase',
]
let wrapper: VueWrapper | undefined

function mountSidebar() {
  wrapper = mount(AppSidebar, {
    global: {
      stubs: {
        RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        VersionBadge: true,
      },
    },
  })
  return wrapper
}

function navPaths() {
  return wrapper!.get('nav').findAll('a').map(link => link.attributes('href'))
}

beforeEach(() => {
  vi.clearAllMocks()
  state.auth.user.role = 'user'
  state.auth.isSimpleMode = false
  state.app.sidebarCollapsed = false
  state.app.backendModeEnabled = false
  state.app.cachedPublicSettings = {
    subscription_enabled: true,
    payment_enabled: true,
    affiliate_enabled: true,
    available_channels_enabled: true,
    channel_monitor_enabled: true,
    custom_menu_items: [{ id: 'custom-user', label: 'Extra link', visibility: 'user', sort_order: 0, icon_svg: '' }],
  }
  document.documentElement.classList.remove('dark')
  localStorage.removeItem('theme')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('ordinary user sidebar allowlist', () => {
  it.each(['enabled', 'disabled', 'missing'])('keeps exactly eight entries with optional services %s', async (flags) => {
    if (flags === 'disabled') {
      Object.assign(state.app.cachedPublicSettings, {
        subscription_enabled: false, payment_enabled: false, affiliate_enabled: false,
      })
    } else if (flags === 'missing') {
      delete state.app.cachedPublicSettings.subscription_enabled
      delete state.app.cachedPublicSettings.payment_enabled
      delete state.app.cachedPublicSettings.affiliate_enabled
    }
    const sidebar = mountSidebar()
    await flushPromises()
    expect(navPaths()).toEqual(expectedUserPaths)
    expect(sidebar.get('nav a[href="/purchase"]').text()).toBe('充值中心（无手续费）')
    expect(sidebar.text()).not.toContain('Extra link')
    expect(sidebar.text()).toMatch(/nav\.(darkMode|lightMode)/)
    expect(sidebar.text()).toContain('nav.collapse')
  })

  it('keeps the fixed allowlist in simple mode as well', async () => {
    state.auth.isSimpleMode = true
    mountSidebar()
    await flushPromises()
    expect(navPaths()).toEqual(expectedUserPaths)
  })

  it.each(['admin', 'super_admin'] as const)('preserves the existing personal and management menus for %s', async (role) => {
    state.auth.user.role = role
    mountSidebar()
    await flushPromises()
    const paths = navPaths()
    expect(paths).toContain('/admin/users')
    expect(paths).toContain('/batch-image')
    expect(paths).toContain('/available-channels')
    expect(paths).toContain('/monitor')
    expect(paths).toContain('/orders')
    expect(paths).toContain('/custom/custom-user')
    expect(paths.includes('/admin/settings')).toBe(role === 'super_admin')
    expect(wrapper!.get('nav a[href="/purchase"]').text()).toBe('nav.buySubscription')
  })

  it('still respects disabled optional services for the administrator personal menu', async () => {
    state.auth.user.role = 'admin'
    Object.assign(state.app.cachedPublicSettings, {
      subscription_enabled: false, payment_enabled: false, affiliate_enabled: false,
    })
    mountSidebar()
    await flushPromises()
    expect(navPaths()).not.toContain('/subscriptions')
    expect(navPaths()).not.toContain('/purchase')
    expect(navPaths()).not.toContain('/affiliate')
    expect(navPaths()).toContain('/monitor')
  })

  it('replaces administrator links with the strict user menu when the role changes', async () => {
    state.auth.user.role = 'admin'
    mountSidebar()
    await flushPromises()
    useAuthStore().user!.role = 'user'
    useAppStore().cachedPublicSettings = {
      ...useAppStore().cachedPublicSettings,
      payment_enabled: false,
    } as never
    await flushPromises()
    expect(navPaths()).toEqual(expectedUserPaths)
  })
})
