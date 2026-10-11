import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHistory, redeem } from '../redeem'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../client', () => ({ apiClient: { get, post } }))

describe('redeem code response', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserves the backend code DTO and subscription group instead of expecting account totals', async () => {
    const response = {
      id: 7, code: 'SUBSCRIPTION-CODE', type: 'subscription', value: 0, status: 'used',
      used_by: 3, used_at: '2026-10-11T00:00:00Z', created_at: '2026-10-10T00:00:00Z',
      group_id: 12, validity_days: 45, group: { id: 12, name: 'Premium' }
    }
    post.mockResolvedValue({ data: response })

    expect(await redeem('SUBSCRIPTION-CODE')).toEqual(response)
    expect(post).toHaveBeenCalledWith('/redeem', { code: 'SUBSCRIPTION-CODE' })
  })
})

describe('redemption history pagination', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([[undefined, undefined, 1, 20], [3, 50, 3, 50], [2, 100, 2, 100]])(
    'sends page %s and size %s to the server', async (page, size, expectedPage, expectedSize) => {
      const response = { items: [], total: 105, page: expectedPage, page_size: expectedSize, pages: 6 }
      get.mockResolvedValue({ data: response })
      expect(await getHistory(page, size)).toEqual(response)
      expect(get).toHaveBeenCalledWith('/redeem/history', {
        params: { page: expectedPage, page_size: expectedSize }
      })
    }
  )
})
