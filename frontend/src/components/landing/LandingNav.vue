<template>
  <header class="lp-nav" :class="{ 'is-scrolled': scrolled, 'has-links': showModelPlaza || !!docUrl }">
    <nav class="lp-nav-bar" :aria-label="siteName">
      <a href="#top" class="lp-nav-brand" @click.prevent="scrollToTop">
        <img :src="siteLogo || '/logo.svg'" alt="" class="lp-nav-logo" />
        <span class="lp-nav-name">{{ siteName }}</span>
      </a>

      <div v-if="showModelPlaza || docUrl" class="lp-nav-links">
        <router-link v-if="showModelPlaza" to="/model-plaza" class="lp-nav-link">
          {{ t('nav.modelPlaza') }}
        </router-link>
        <a
          v-if="docUrl"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="lp-nav-link"
        >
          {{ t('home.docs') }}
        </a>
      </div>

      <div class="lp-nav-actions">
        <LocaleSwitcher />
        <button
          type="button"
          class="lp-nav-icon"
          :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
          :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')"
          @click="emit('toggle-theme')"
        >
          <Icon v-if="isDark" name="sun" size="sm" />
          <Icon v-else name="moon" size="sm" />
        </button>
        <router-link
          :to="isAuthenticated ? dashboardPath : '/login'"
          class="lp-btn lp-btn-primary lp-btn-sm"
        >
          {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
        </router-link>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { prefersReducedMotion } from './motion'

defineProps<{
  siteName: string
  siteLogo: string
  docUrl: string
  showModelPlaza: boolean
  isAuthenticated: boolean
  dashboardPath: string
  isDark: boolean
}>()

const emit = defineEmits<{ 'toggle-theme': [] }>()

const { t } = useI18n()

// 滚动一小段后，通栏导航收拢成一颗悬浮的磨砂胶囊
const scrolled = ref(false)
const handleScroll = () => {
  scrolled.value = window.scrollY > 24
}

// 用脚本滚动：直接改 hash 会触发路由的“回到顶部”，没有过渡
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

onMounted(() => {
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => window.removeEventListener('scroll', handleScroll))
</script>

<style scoped>
.lp-nav {
  position: fixed;
  inset: 0 0 auto;
  z-index: 50;
  padding: 14px 16px 0;
  pointer-events: none;
}

.lp-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1120px;
  margin-inline: auto;
  padding: 8px 8px 8px 14px;
  border: 1px solid transparent;
  border-radius: 9999px;
  pointer-events: auto;
  transition:
    max-width 0.7s var(--lp-ease-spring),
    background-color 0.4s ease,
    border-color 0.4s ease,
    box-shadow 0.4s ease;
}

.lp-nav.is-scrolled .lp-nav-bar {
  /* 中间没有链接时胶囊收得更窄，避免左右两组之间空出一大截 */
  max-width: 520px;
  border-color: var(--lp-line);
  background-color: color-mix(in srgb, var(--lp-bg) 72%, transparent);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 12px 36px -16px rgb(0 0 0 / 0.35);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
}

.lp-nav.is-scrolled.has-links .lp-nav-bar {
  max-width: 780px;
}

.lp-nav-brand {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--lp-text);
}

.lp-nav-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
  object-fit: contain;
  transition: transform 0.6s var(--lp-ease-spring);
}

.lp-nav-brand:hover .lp-nav-logo {
  transform: rotate(-8deg) scale(1.08);
}

.lp-nav-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-nav-links {
  display: none;
  align-items: center;
  gap: 2px;
}

@media (min-width: 820px) {
  .lp-nav-links {
    display: flex;
  }
}

.lp-nav-link {
  padding: 7px 12px;
  border-radius: 9999px;
  font-size: 14px;
  color: var(--lp-text-2);
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.lp-nav-link:hover {
  background-color: var(--lp-inset);
  color: var(--lp-text);
}

.lp-nav-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.lp-nav-icon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: var(--lp-text-2);
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    transform 0.5s var(--lp-ease-spring);
}

.lp-nav-icon:hover {
  background-color: var(--lp-inset);
  color: var(--lp-text);
}

.lp-nav-icon:active {
  transform: scale(0.9) rotate(20deg);
}

.lp-nav-actions .lp-btn {
  margin-left: 6px;
}
</style>
