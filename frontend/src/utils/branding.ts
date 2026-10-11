import { sanitizeUrl } from '@/utils/url'

export function updateFavicon(logoUrl: string): void {
  const sanitizedLogoUrl = sanitizeUrl(logoUrl, {
    allowRelative: true,
    allowDataUrl: true,
  })
  if (!sanitizedLogoUrl) {
    return
  }

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }

  link.removeAttribute('type')
  link.href = sanitizedLogoUrl
}

// 上游内置的两条英文副标题。系统设置里没改过副标题时，接口返回的就是其中之一。
const STOCK_SITE_SUBTITLES = ['AI API Gateway Platform', 'Subscription to API Conversion Platform']

/**
 * 管理员自定义的站点副标题；没设置（或仍是内置默认值）时返回空字符串，
 * 由调用方换成跟随界面语言的默认文案。
 */
export function customSiteSubtitle(subtitle: string | null | undefined): string {
  const trimmed = (subtitle || '').trim()
  return STOCK_SITE_SUBTITLES.includes(trimmed) ? '' : trimmed
}
