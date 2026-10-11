import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RedeemView from '../RedeemView.vue'

const { redeem, getHistory, refreshUser, fetchActiveSubscriptions, showError, showWarning, showSuccess } = vi.hoisted(() => ({
  redeem: vi.fn(),
  getHistory: vi.fn(),
  refreshUser: vi.fn(),
  fetchActiveSubscriptions: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api', () => ({
  redeemAPI: { redeem, getHistory },
  authAPI: { getPublicSettings: vi.fn().mockResolvedValue({}) },
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { balance: 10, concurrency: 2 }, refreshUser }),
}))
vi.mock('@/stores/subscriptions', () => ({
  useSubscriptionStore: () => ({ fetchActiveSubscriptions }),
}))
vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showWarning, showSuccess }),
}))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({
    t: (key: string, values?: Record<string, unknown>) => values ? `${key}: ${Object.values(values).join(', ')}` : key,
  }) }
})

function redeemedCode(type = 'balance', overrides: Record<string, unknown> = {}) {
  return {
    id: 1, code: 'REDEEM-CODE', type, value: 20, status: 'used', used_by: 3,
    used_at: '2026-10-11T00:00:00Z', created_at: '2026-10-10T00:00:00Z',
    group_id: null, validity_days: 0,
    ...overrides,
  }
}

async function submitCode() {
  const wrapper = mount(RedeemView, {
    global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
  })
  await flushPromises()
  await wrapper.get('input#code').setValue(' REDEEM-CODE ')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  return wrapper
}

describe('RedeemView refresh after redemption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redeem.mockResolvedValue(redeemedCode())
    getHistory.mockResolvedValue({ items: [], total: 0 })
    refreshUser.mockResolvedValue({ balance: 30, concurrency: 2 })
    fetchActiveSubscriptions.mockResolvedValue([])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(['balance', 'concurrency', 'subscription'])(
    'keeps a successful %s redemption when profile refresh fails', async (type) => {
      redeem.mockResolvedValue(redeemedCode(type))
      refreshUser.mockRejectedValue({ status: 503, message: 'Service unavailable' })
      getHistory.mockResolvedValueOnce({ items: [], total: 0 }).mockResolvedValueOnce({ total: 1, items: [{
        id: 1, code: 'REDEEM-CODE', type, value: 20, used_at: '2026-03-08T00:00:00Z',
      }] })

      const wrapper = await submitCode()

      expect(redeem).toHaveBeenCalledWith('REDEEM-CODE')
      expect(showError).not.toHaveBeenCalled()
      expect(showWarning).toHaveBeenCalledWith('redeem.userRefreshFailed')
      expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
      const success = wrapper.get('[data-testid="redeem-success"]')
      expect(success.text()).toContain('redeem.redeemSuccess')
      expect(success.text()).not.toContain('redeem.newBalance')
      expect(success.text()).not.toContain('redeem.newConcurrency')
      expect(wrapper.text()).not.toContain('redeem.failedToRedeem')
      expect((wrapper.get('input#code').element as HTMLInputElement).value).toBe('')
      expect((wrapper.get('input#code').element as HTMLInputElement).disabled).toBe(false)
      expect(getHistory).toHaveBeenCalledTimes(2)
      expect(wrapper.text()).toContain('REDEEM-C...')
      if (type === 'subscription') {
        expect(fetchActiveSubscriptions).toHaveBeenCalledWith(true)
      } else {
        expect(fetchActiveSubscriptions).not.toHaveBeenCalled()
      }
      wrapper.unmount()
    }
  )

  it('shows the credited amount and refreshed balance from a balance code DTO', async () => {
    redeem.mockResolvedValue(redeemedCode('balance', { value: 12.5 }))
    refreshUser.mockResolvedValue({ balance: 42.75, concurrency: 2 })

    const wrapper = await submitCode()
    const success = wrapper.get('[data-testid="redeem-success"]').text()

    expect(success).toContain('redeem.balanceAddedRedeem')
    expect(success).toContain('redeem.added: $12.50')
    expect(success).toContain('redeem.newBalance: $42.75')
    expect(success).not.toContain('redeem.newConcurrency')
    expect(success).not.toContain('$22.50')
    wrapper.unmount()
  })

  it('shows the added requests and refreshed concurrency from a concurrency code DTO', async () => {
    redeem.mockResolvedValue(redeemedCode('concurrency', { value: 4 }))
    refreshUser.mockResolvedValue({ balance: 10, concurrency: 7 })

    const wrapper = await submitCode()
    const success = wrapper.get('[data-testid="redeem-success"]').text()

    expect(success).toContain('redeem.concurrencyAddedRedeem')
    expect(success).toContain('redeem.added: 4 redeem.concurrentRequests')
    expect(success).toContain('redeem.newConcurrency: 7 redeem.requests')
    expect(success).not.toContain('redeem.newBalance')
    wrapper.unmount()
  })

  it('shows the subscription group and validity days from a subscription code DTO', async () => {
    redeem.mockResolvedValue(redeemedCode('subscription', {
      value: 0, group_id: 12, group: { id: 12, name: 'Premium Group' }, validity_days: 45,
    }))

    const wrapper = await submitCode()
    const success = wrapper.get('[data-testid="redeem-success"]').text()

    expect(success).toContain('redeem.subscriptionAssignedDesc: Premium Group')
    expect(success).toMatch(/redeem\.subscriptionAssigned\s+- Premium Group/)
    expect(success).toContain('redeem.subscriptionDays: 45')
    expect(success).not.toContain('redeem.newBalance')
    expect(success).not.toContain('redeem.newConcurrency')
    expect(fetchActiveSubscriptions).toHaveBeenCalledWith(true)
    wrapper.unmount()
  })

  it('waits for the profile refresh before showing a new total and preserves a zero balance', async () => {
    let resolveProfile!: (profile: { balance: number; concurrency: number }) => void
    refreshUser.mockImplementationOnce(() => new Promise(resolve => { resolveProfile = resolve }))
    const wrapper = await submitCode()
    const success = () => wrapper.get('[data-testid="redeem-success"]').text()

    expect(success()).toContain('redeem.added: $20.00')
    expect(success()).not.toContain('redeem.newBalance')
    expect(success()).not.toContain('$10.00')
    resolveProfile({ balance: 0, concurrency: 2 })
    await flushPromises()
    expect(success()).toContain('redeem.newBalance: $0.00')
    expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
    wrapper.unmount()
  })

  it('pages on the server, changes size, and resets page and total after redeeming', async () => {
    getHistory.mockResolvedValue({ items: [], total: 101 })
    const wrapper = mount(RedeemView, {
      global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
    })
    await flushPromises()
    const button = (text: string) => wrapper.findAll('button').find(b => b.text() === text)!
    expect(getHistory).toHaveBeenLastCalledWith(1, 20)
    expect(button('pagination.previous').attributes('disabled')).toBeDefined()
    await button('pagination.next').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(2, 20)
    await button('pagination.previous').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 20)
    expect(wrapper.findAll('select option').map(o => o.text())).toEqual(['20', '50', '100'])
    await wrapper.get('select').setValue('50')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 50)
    await wrapper.get('select').setValue('100')
    await flushPromises()
    await button('pagination.next').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(2, 100)
    expect(button('pagination.next').attributes('disabled')).toBeDefined()
    getHistory.mockResolvedValue({ items: [], total: 102 })
    await wrapper.get('input#code').setValue('NEW-CODE')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 100)
    expect(wrapper.text()).toContain('102')
    expect(button('pagination.previous').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('restores the loaded size and keeps rows and navigation usable after a size request fails', async () => {
    const item = { id: 1, code: 'OLD-ROWS', type: 'balance', value: 20, used_at: '2026-03-08T00:00:00Z' }
    getHistory.mockResolvedValue({ items: [item], total: 61 })
    const wrapper = mount(RedeemView, {
      global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
    })
    await flushPromises()
    const button = (text: string) => wrapper.findAll('button').find(b => b.text() === text)!
    await button('pagination.next').trigger('click')
    await flushPromises()
    let rejectRequest!: (error: Error) => void
    getHistory.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject }))
    await wrapper.get('select').setValue('50')
    expect(getHistory).toHaveBeenLastCalledWith(1, 50)
    expect(button('pagination.next').attributes('disabled')).toBeDefined()
    rejectRequest(new Error('Network error'))
    await flushPromises()
    expect(wrapper.get('select').element.value).toBe('20')
    expect(wrapper.text()).toContain('OLD-ROWS')
    expect(wrapper.text()).toContain('61')
    expect(button('pagination.previous').attributes('disabled')).toBeUndefined()
    expect(button('pagination.next').attributes('disabled')).toBeUndefined()
    expect(showError).toHaveBeenCalledWith('redeem.historyLoadFailed')
    await button('pagination.next').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(3, 20)
    await wrapper.get('select').setValue('50')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 50)
    expect(wrapper.get('select').element.value).toBe('50')
    expect(button('pagination.previous').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it.each(['success', 'failure'])('ignores a stale history %s after a newer size request succeeds', async (outcome) => {
    let resolveOld!: (value: unknown) => void
    let rejectOld!: (error: Error) => void
    getHistory.mockImplementationOnce(() => new Promise((resolve, reject) => {
      resolveOld = resolve
      rejectOld = reject
    }))
    const wrapper = mount(RedeemView, {
      global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
    })
    getHistory.mockResolvedValue({ items: [{
      id: 2, code: 'NEW-ROWS', type: 'balance', value: 30, used_at: '2026-03-08T00:00:00Z',
    }], total: 61 })
    // Force overlapping requests to exercise responses arriving out of order.
    await wrapper.get('select').setValue('50')
    await flushPromises()
    const button = (text: string) => wrapper.findAll('button').find(b => b.text() === text)!
    await button('pagination.next').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(2, 50)
    if (outcome === 'success') {
      resolveOld({ items: [], total: 0 })
    } else {
      rejectOld(new Error('Stale network error'))
    }
    await flushPromises()
    expect(wrapper.get('select').element.value).toBe('50')
    expect(wrapper.text()).toContain('NEW-ROWS')
    expect(wrapper.text()).toContain('61')
    expect(button('pagination.previous').attributes('disabled')).toBeUndefined()
    expect(button('pagination.next').attributes('disabled')).toBeDefined()
    expect(wrapper.get('select').attributes('disabled')).toBeUndefined()
    expect(showError).not.toHaveBeenCalled()
    await button('pagination.previous').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 50)
    wrapper.unmount()
  })

  it('disables both paging buttons for empty history', async () => {
    const wrapper = await submitCode()
    for (const button of wrapper.findAll('button').filter(b => b.text().startsWith('pagination.'))) {
      expect(button.attributes('disabled')).toBeDefined()
    }
    wrapper.unmount()
  })

  it('finishes normally without a warning when profile refresh succeeds', async () => {
    const wrapper = await submitCode()

    expect(refreshUser).toHaveBeenCalledOnce()
    expect(showWarning).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
    expect((wrapper.get('input#code').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('preserves the existing subscription refresh warning after successful redemption', async () => {
    redeem.mockResolvedValue(redeemedCode('subscription'))
    fetchActiveSubscriptions.mockRejectedValue(new Error('Network Error'))
    const wrapper = await submitCode()

    expect(showWarning).toHaveBeenCalledWith('redeem.subscriptionRefreshFailed')
    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
    expect(getHistory).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('keeps the code and reports failure when the redemption request itself fails', async () => {
    redeem.mockRejectedValue({ response: { data: { detail: 'Invalid code' } } })
    const wrapper = await submitCode()

    expect(showError).toHaveBeenCalledWith('redeem.redeemFailed')
    expect(wrapper.text()).toContain('Invalid code')
    expect(wrapper.find('[data-testid="redeem-success"]').exists()).toBe(false)
    expect((wrapper.get('input#code').element as HTMLInputElement).value).toBe(' REDEEM-CODE ')
    expect(refreshUser).not.toHaveBeenCalled()
    expect(fetchActiveSubscriptions).not.toHaveBeenCalled()
    expect(getHistory).toHaveBeenCalledOnce()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showWarning).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
