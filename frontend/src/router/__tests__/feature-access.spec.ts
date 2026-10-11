import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type NavigationGuard = (
  to: Record<string, any>,
  from: Record<string, any>,
  next: ReturnType<typeof vi.fn>
) => Promise<void>

const routerHarness = vi.hoisted(() => ({
  guard: null as NavigationGuard | null,
  routes: [] as Array<{ path: string; meta?: Record<string, unknown> }>,
}))

const authStore = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  isAuthenticated: true,
  isAdmin: false,
  isSuperAdmin: false,
  isSimpleMode: false,
  hasPendingAuthSession: false,
}))

const appStore = vi.hoisted(() => ({
  siteName: 'token',
  backendModeEnabled: false,
  publicSettingsLoaded: false,
  cachedPublicSettings: null as null | {
    payment_enabled?: boolean
    risk_control_enabled?: boolean
    subscription_enabled?: boolean
    custom_menu_items?: []
  },
  fetchPublicSettings: vi.fn(),
}))

vi.mock('vue-router', () => ({
  createWebHistory: vi.fn(() => ({})),
  createRouter: vi.fn((options) => {
    routerHarness.routes = options.routes
    return {
      beforeEach: vi.fn((guard: NavigationGuard) => {
        routerHarness.guard = guard
      }),
      afterEach: vi.fn(),
      onError: vi.fn(),
    }
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStore,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => appStore,
}))

vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => ({ customMenuItems: [] }),
}))

vi.mock('@/i18n', () => ({ i18n: { global: { t: (key: string) => key } } }))

vi.mock('@/stores/adminCompliance', () => ({
  useAdminComplianceStore: () => ({
    initialized: true,
    fetchStatus: vi.fn(),
    requireAcknowledgement: vi.fn(),
  }),
}))

vi.mock('@/composables/useNavigationLoading', () => ({
  useNavigationLoadingState: () => ({
    startNavigation: vi.fn(),
    endNavigation: vi.fn(),
    isLoading: { value: false },
  }),
}))

vi.mock('@/composables/useRoutePrefetch', () => ({
  useRoutePrefetch: () => ({
    triggerPrefetch: vi.fn(),
    cancelPendingPrefetch: vi.fn(),
    resetPrefetchState: vi.fn(),
  }),
}))

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function runGuard(meta: Record<string, unknown>, path: string) {
  if (!routerHarness.guard) {
    throw new Error('router guard was not registered')
  }

  const next = vi.fn()
  const navigation = routerHarness.guard(
    {
      path,
      fullPath: path,
      name: 'FeatureRoute',
      params: {},
      meta: { requiresAuth: true, ...meta },
    },
    {},
    next
  )
  return { navigation, next }
}

describe('feature route guard', () => {
  beforeAll(async () => {
    await import('@/router')
  })

  beforeEach(() => {
    authStore.isAuthenticated = true
    authStore.isAdmin = false
    authStore.isSuperAdmin = false
    authStore.isSimpleMode = false
    appStore.publicSettingsLoaded = false
    appStore.cachedPublicSettings = null
    appStore.fetchPublicSettings.mockReset()
  })

  it('waits for the first public-settings request before deciding payment access', async () => {
    const deferred = createDeferred<{ payment_enabled: boolean }>()
    appStore.fetchPublicSettings.mockImplementation(async () => {
      const settings = await deferred.promise
      appStore.cachedPublicSettings = settings
      appStore.publicSettingsLoaded = true
      return settings
    })

    const { navigation, next } = runGuard({ requiresPayment: true }, '/purchase')

    await vi.waitFor(() => expect(appStore.fetchPublicSettings).toHaveBeenCalledTimes(1))
    expect(next).not.toHaveBeenCalled()

    deferred.resolve({ payment_enabled: true })
    await navigation
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })

  it.each([
    ['payment', { requiresPayment: true }, '/purchase'],
    ['risk control', { requiresRiskControl: true }, '/admin/risk-control'],
    ['subscription', { requiresSubscription: true }, '/subscriptions'],
  ])('does not treat a failed %s settings load as explicitly disabled', async (_name, meta, path) => {
    authStore.isAdmin = meta.requiresRiskControl === true
    appStore.fetchPublicSettings.mockResolvedValue(null)

    const { navigation, next } = runGuard(meta, path)
    await navigation

    expect(appStore.publicSettingsLoaded).toBe(false)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })

  it.each([
    ['payment', { requiresPayment: true }, { payment_enabled: false }, '/dashboard'],
    [
      'risk control',
      { requiresRiskControl: true },
      { risk_control_enabled: false },
      '/admin/dashboard',
    ],
    ['subscription', { requiresSubscription: true }, { subscription_enabled: false }, '/dashboard'],
  ])('redirects when loaded settings explicitly disable %s', async (_name, meta, settings, target) => {
    authStore.isAdmin = meta.requiresRiskControl === true
    appStore.cachedPublicSettings = settings
    appStore.publicSettingsLoaded = true

    const { navigation, next } = runGuard(meta, '/feature')
    await navigation

    expect(appStore.fetchPublicSettings).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith(target)
  })
})

describe('subscription route guard (opt-out flag)', () => {
  beforeEach(() => {
    authStore.isAdmin = false
    authStore.isSimpleMode = false
    appStore.publicSettingsLoaded = true
    appStore.fetchPublicSettings.mockReset()
  })

  it.each([
    ['missing key', {}],
    ['explicit true', { subscription_enabled: true }],
  ])('lets /subscriptions through when the flag is %s', async (_name, settings) => {
    appStore.cachedPublicSettings = settings

    const { navigation, next } = runGuard({ requiresSubscription: true }, '/subscriptions')
    await navigation

    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })

  it('sends admins to the admin dashboard when subscriptions are disabled', async () => {
    authStore.isAdmin = true
    appStore.cachedPublicSettings = { subscription_enabled: false }

    const { navigation, next } = runGuard({ requiresSubscription: true }, '/subscriptions')
    await navigation

    expect(next).toHaveBeenCalledWith('/admin/dashboard')
  })

  it('blocks a regular administrator from super administrator routes', async () => {
    authStore.isAdmin = true
    const { navigation, next } = runGuard({ requiresAdmin: true, requiresSuperAdmin: true }, '/admin/settings')
    await navigation
    expect(next).toHaveBeenCalledWith('/admin/dashboard')
  })

  it('permits a super administrator to access system settings', async () => {
    authStore.isAdmin = true
    authStore.isSuperAdmin = true
    const { navigation, next } = runGuard({ requiresAdmin: true, requiresSuperAdmin: true }, '/admin/settings')
    await navigation
    expect(next).toHaveBeenCalledWith()
  })

})

describe('channel status role access', () => {
  beforeEach(() => {
    authStore.isAuthenticated = true
    authStore.isSimpleMode = false
    authStore.isAdmin = false
    authStore.isSuperAdmin = false
  })

  function runChannelStatusGuard() {
    const route = routerHarness.routes.find(({ path }) => path === '/monitor')
    expect(route).toBeDefined()
    return runGuard(route!.meta!, route!.path)
  }

  it('redirects an ordinary user away from the channel status URL', async () => {
    const { navigation, next } = runChannelStatusGuard()
    await navigation
    expect(next).toHaveBeenCalledWith('/dashboard')
  })

  it.each(['admin', 'super_admin'])('permits the %s role to view channel status', async (role) => {
    authStore.isAdmin = true
    authStore.isSuperAdmin = role === 'super_admin'
    const { navigation, next } = runChannelStatusGuard()
    await navigation
    expect(next).toHaveBeenCalledWith()
  })

  it.each(['/subscriptions', '/purchase', '/affiliate', '/orders', '/redeem'])(
    'keeps %s accessible so a disabled service can show its availability message', async (path) => {
      appStore.publicSettingsLoaded = true
      appStore.cachedPublicSettings = { subscription_enabled: false, payment_enabled: false }
      const route = routerHarness.routes.find((route) => route.path === path)
      expect(route).toBeDefined()
      const { navigation, next } = runGuard(route!.meta!, path)
      await navigation
      expect(next).toHaveBeenCalledWith()
    },
  )

  it.each(['/subscriptions', '/redeem'])(
    'lets the fixed user menu reach the %s availability message in simple mode', async (path) => {
      authStore.isSimpleMode = true
      const route = routerHarness.routes.find((route) => route.path === path)
      expect(route).toBeDefined()
      const { navigation, next } = runGuard(route!.meta!, path)
      await navigation
      expect(next).toHaveBeenCalledWith()
    },
  )

  it.each(['/admin/subscriptions', '/admin/redeem'])(
    'keeps %s restricted in simple mode', async (path) => {
      authStore.isAdmin = true
      authStore.isSimpleMode = true
      const route = routerHarness.routes.find((route) => route.path === path)
      expect(route).toBeDefined()
      const { navigation, next } = runGuard(route!.meta!, path)
      await navigation
      expect(next).toHaveBeenCalledWith('/admin/dashboard')
    },
  )
})
