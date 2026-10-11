<template>
  <footer class="lp-footer">
    <div class="lp-container lp-footer-inner">
      <div class="lp-footer-brand">
        <img :src="siteLogo || '/logo.svg'" alt="" class="lp-footer-logo" />
        <span>{{ siteName }}</span>
        <span class="lp-footer-tagline">{{ t('home.landing.footer.tagline') }}</span>
      </div>

      <nav class="lp-footer-links" :aria-label="t('home.landing.footer.tagline')">
        <router-link v-if="showModelPlaza" to="/model-plaza">{{ t('nav.modelPlaza') }}</router-link>
        <router-link to="/key-usage">{{ t('home.landing.nav.usage') }}</router-link>
        <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ t('home.docs') }}</a>
        <a :href="githubUrl" target="_blank" rel="noopener noreferrer">GitHub</a>
      </nav>
    </div>

    <div class="lp-container">
      <p class="lp-footer-copy">
        &copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}
      </p>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  siteName: string
  siteLogo: string
  docUrl: string
  githubUrl: string
  showModelPlaza: boolean
}>()

const { t } = useI18n()
const currentYear = new Date().getFullYear()
</script>

<style scoped>
.lp-footer {
  position: relative;
  padding-block: 40px 32px;
  border-top: 1px solid var(--lp-line);
}

.lp-footer-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px 32px;
}

.lp-footer-brand {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--lp-text);
}

.lp-footer-logo {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  object-fit: contain;
}

.lp-footer-tagline {
  padding-left: 12px;
  border-left: 1px solid var(--lp-line-strong);
  font-size: 13px;
  font-weight: 400;
  color: var(--lp-text-3);
}

.lp-footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  font-size: 14px;
}

.lp-footer-links a {
  position: relative;
  color: var(--lp-text-2);
  transition: color 0.2s ease;
}

/* 下划线从左向右展开 */
.lp-footer-links a::after {
  content: '';
  position: absolute;
  inset: auto 0 -3px;
  height: 1px;
  background-color: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.45s var(--lp-ease-spring);
}

.lp-footer-links a:hover {
  color: var(--lp-text);
}

.lp-footer-links a:hover::after {
  transform: scaleX(1);
}

.lp-footer-copy {
  margin-top: 28px;
  font-size: 13px;
  color: var(--lp-text-3);
}
</style>
