import { createApp, defineComponent, h, ref, watch } from 'vue'
import { createI18n } from 'vue-i18n'
import SubscriptionCatalog from '@/components/payment/SubscriptionCatalog.vue'
import '../style.css'
import './subscription-preview.css'

type PreviewLocale = 'zh' | 'en'
const copy = {
  zh: {
    subscription: '我的订阅',
    preview: '界面预览',
    notice: '浏览方案与权益，购买及充值暂未开放。',
    language: '切换语言',
    light: '切换为浅色',
    dark: '切换为深色',
    footer: 'Kao.AI · 让每一次调用更从容',
  },
  en: {
    subscription: 'My subscription',
    preview: 'Design preview',
    notice: 'Explore plans and benefits. Purchases and top-ups are not available yet.',
    language: 'Switch language',
    light: 'Switch to light mode',
    dark: 'Switch to dark mode',
    footer: 'Kao.AI · More room for every idea',
  },
} as const

const params = new URLSearchParams(window.location.search)
const initialLocale: PreviewLocale = params.get('lang') === 'en' ? 'en' : 'zh'
const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'zh',
  messages: { zh: {}, en: {} },
})

const Preview = defineComponent({
  name: 'SubscriptionPreview',
  setup() {
    const dark = ref(params.get('theme') === 'dark')
    const locale = i18n.global.locale
    watch([locale, dark], ([language, isDark]) => {
      document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
      document.documentElement.classList.toggle('dark', isDark)
      document.title = language === 'zh' ? 'Kao.AI · 订阅方案预览' : 'Kao.AI · Subscription preview'
      const url = new URL(window.location.href)
      url.searchParams.set('lang', language)
      url.searchParams.set('theme', isDark ? 'dark' : 'light')
      window.history.replaceState(null, '', url)
    }, { immediate: true })

    return () => {
      const language = locale.value as PreviewLocale
      const text = copy[language]
      const themeLabel = dark.value ? text.light : text.dark
      return h('div', { class: 'subscription-preview' }, [
        h('header', { class: 'preview-header' }, [
          h('div', { class: 'preview-header-inner' }, [
            h('a', { href: '#plans', class: 'preview-brand', 'aria-label': 'Kao.AI' }, [
              h('span', { class: 'preview-brand-mark', 'aria-hidden': 'true' }, 'K'),
              h('span', 'Kao.AI'),
            ]),
            h('nav', { class: 'preview-navigation', 'aria-label': language === 'zh' ? '当前位置' : 'Current page' }, [
              h('span', { class: 'preview-nav-divider', 'aria-hidden': 'true' }, '/'),
              h('span', { 'aria-current': 'page' }, text.subscription),
            ]),
            h('div', { class: 'preview-controls' }, [
              h('span', { class: 'preview-badge' }, text.preview),
              h('button', {
                type: 'button', class: 'preview-control', 'aria-label': text.language,
                onClick: () => { locale.value = language === 'zh' ? 'en' : 'zh' },
              }, language === 'zh' ? 'EN' : '中文'),
              h('button', {
                type: 'button', class: 'preview-control preview-theme',
                'aria-label': themeLabel, title: themeLabel, 'aria-pressed': dark.value,
                onClick: () => { dark.value = !dark.value },
              }, dark.value ? '☀' : '☾'),
            ]),
          ]),
        ]),
        h('main', { id: 'plans', class: 'preview-main' }, [
          h('p', { class: 'preview-notice', role: 'note' }, [
            h('span', { class: 'preview-notice-dot', 'aria-hidden': 'true' }),
            text.notice,
          ]),
          h(SubscriptionCatalog),
        ]),
        h('footer', { class: 'preview-footer' }, text.footer),
      ])
    }
  },
})

createApp(Preview).use(i18n).mount('#app')
