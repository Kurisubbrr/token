<template>
  <!-- 登录、注册、找回密码等页面的外壳：沿用首页的配色与动效（样式见 styles/landing.css） -->
  <div class="lp lp-auth" :class="{ 'is-returning': returning }">
    <div class="lp-aurora" aria-hidden="true">
      <div class="lp-aurora-glow lp-aurora-glow-a" />
      <div class="lp-aurora-glow lp-aurora-glow-b" />
      <div class="lp-aurora-grid" />
    </div>

    <header class="auth-bar">
      <router-link to="/home" class="auth-back">
        <Icon name="arrowLeft" size="sm" :stroke-width="2" class="auth-back-arrow" />
        <span>{{ t('home.backToHome') }}</span>
      </router-link>

      <div class="auth-bar-actions">
        <LocaleSwitcher />
        <button
          type="button"
          class="auth-icon-btn"
          :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
          :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')"
          @click="toggleTheme"
        >
          <Icon v-if="isDark" name="sun" size="sm" />
          <Icon v-else name="moon" size="sm" />
        </button>
      </div>
    </header>

    <main class="auth-main">
      <!-- 左侧：品牌与卖点，只在宽屏显示 -->
      <section class="auth-showcase" aria-hidden="true">
        <div class="auth-brand auth-rise" style="--i: 0">
          <img v-if="settingsLoaded" :src="siteLogo || '/logo.svg'" alt="" class="auth-brand-logo" />
          <span>{{ siteName }}</span>
        </div>

        <p class="auth-headline">
          <span v-for="(line, lineIndex) in headlineLines" :key="lineIndex" class="auth-headline-line">
            <span
              v-for="(unit, index) in line.units"
              :key="index"
              class="auth-headline-unit"
              :style="{ '--i': line.offset + index }"
              >{{ unit }}</span
            >
          </span>
        </p>
        <p class="lp-lead auth-desc auth-rise" style="--i: 3">
          {{ t('home.landing.hero.description') }}
        </p>

        <div class="auth-orbit auth-rise" style="--i: 5">
          <DemoOrbit />
        </div>

        <ul class="auth-points">
          <li
            v-for="(point, index) in points"
            :key="point"
            class="auth-rise"
            :style="{ '--i': 7 + index }"
          >
            <span class="auth-point-check"><Icon name="check" size="xs" :stroke-width="2.5" /></span>
            {{ t(`home.landing.features.${point}.title`) }}
          </li>
        </ul>
      </section>

      <!-- 右侧：表单 -->
      <section class="auth-panel">
        <div class="auth-panel-brand auth-rise" style="--i: 0">
          <template v-if="settingsLoaded">
            <img :src="siteLogo || '/logo.svg'" alt="Logo" class="auth-panel-logo" />
            <h1>{{ siteName }}</h1>
            <p>{{ siteSubtitle }}</p>
          </template>
        </div>

        <div v-spotlight class="auth-card-wrap auth-rise" style="--i: 1">
          <div class="lp-card auth-card">
            <span class="lp-beam" aria-hidden="true" />
            <div class="auth-card-body">
              <slot />
            </div>
          </div>
        </div>

        <div class="auth-footer auth-rise" style="--i: 2">
          <slot name="footer" />
        </div>

        <p class="auth-copyright auth-rise" style="--i: 3">
          &copy; {{ currentYear }} {{ siteName }}. All rights reserved.
        </p>
      </section>
    </main>
  </div>
</template>

<script lang="ts">
// 登录 ↔ 注册来回切换时，每次都会重新挂载这个外壳。
// 用模块级标记记住“已经进过场”，之后左侧的品牌区直接呈现，只有表单卡片重新入场。
let shellShown = false
</script>

<script setup lang="ts">
import '@/styles/landing.css'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import Icon from '@/components/icons/Icon.vue'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import DemoOrbit from '@/components/landing/DemoOrbit.vue'
import { vSpotlight } from '@/components/landing/motion'
import { sanitizeUrl } from '@/utils/url'
import { customSiteSubtitle } from '@/utils/branding'

const { t } = useI18n()
const appStore = useAppStore()

const returning = shellShown
shellShown = true

const siteName = computed(() => appStore.siteName || 'token')
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
// 副标题没自定义时，用跟随界面语言的默认文案，而不是上游内置的英文句子
const siteSubtitle = computed(
  () => customSiteSubtitle(appStore.cachedPublicSettings?.site_subtitle) || t('home.landing.footer.tagline')
)
const settingsLoaded = computed(() => appStore.publicSettingsLoaded)

const currentYear = computed(() => new Date().getFullYear())

const points = ['oneKey', 'routing', 'billing', 'compat'] as const

// 标语逐字浮现：中日韩文字按字拆，拉丁文字按单词拆（保留词间空格）
function splitUnits(text: string): string[] {
  const units: string[] = []
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue
    if (/^\s+$/.test(part)) {
      if (units.length) units[units.length - 1] += ' '
    } else if (/[\u2e80-\u9fff\uff00-\uffef]/.test(part)) {
      units.push(...Array.from(part))
    } else {
      units.push(part)
    }
  }
  return units
}

// 中文标语在逗号后换行（“一个密钥，/ 接入所有大模型”），避免行尾只剩两个字
const headlineLines = computed(() => {
  let offset = 0
  // 不用正则后行断言来切分：旧版 Safari 不支持，整段脚本会因语法错误而无法加载
  const parts = t('home.landing.hero.tagline').split('，')
  return parts.map((text, index) => {
    const units = splitUnits(index < parts.length - 1 ? `${text}，` : text)
    const line = { units, offset }
    offset += units.length
    return line
  })
})

// 主题切换：与首页、侧栏写入同一个 localStorage 键
const isDark = ref(document.documentElement.classList.contains('dark'))

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

onMounted(() => {
  appStore.fetchPublicSettings()
})
</script>

<style scoped>
.lp-auth {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
}

/* ---- 顶部：返回首页 + 语言 / 主题 ---- */

.auth-bar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 0;
  animation: auth-fade 0.8s var(--lp-ease-out) backwards;
}

@media (min-width: 640px) {
  .auth-bar {
    padding: 22px 28px 0;
  }
}

/* 返回首页：一颗描边胶囊，悬停时箭头向左滑一小步 */
.auth-back {
  display: inline-flex;
  height: 38px;
  align-items: center;
  gap: 6px;
  padding: 0 16px 0 12px;
  border: 1px solid var(--lp-line-strong);
  border-radius: 9999px;
  background-color: var(--lp-inset);
  font-size: 14px;
  font-weight: 500;
  color: var(--lp-text-2);
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.4s var(--lp-ease-spring);
}

.auth-back:hover {
  border-color: color-mix(in srgb, var(--lp-text) 32%, transparent);
  background-color: color-mix(in srgb, var(--lp-text) 7%, transparent);
  color: var(--lp-text);
}

.auth-back:active {
  transform: scale(0.96);
}

.auth-back:focus-visible,
.auth-icon-btn:focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: 3px;
}

.auth-back-arrow {
  transition: transform 0.45s var(--lp-ease-spring);
}

.auth-back:hover .auth-back-arrow {
  transform: translateX(-3px);
}

.auth-bar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.auth-icon-btn {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: var(--lp-text-2);
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    transform 0.5s var(--lp-ease-spring);
}

.auth-icon-btn:hover {
  background-color: var(--lp-inset);
  color: var(--lp-text);
}

.auth-icon-btn:active {
  transform: scale(0.9) rotate(20deg);
}

/* ---- 主体：宽屏左右两栏，窄屏只留表单 ---- */

.auth-main {
  position: relative;
  z-index: 10;
  display: grid;
  width: 100%;
  max-width: 1120px;
  flex: 1;
  align-items: center;
  margin-inline: auto;
  padding: 28px 20px 40px;
}

@media (min-width: 1024px) {
  .auth-main {
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
    gap: 72px;
    padding: 32px 28px 56px;
  }
}

/* ---- 入场：各元素按 --i 依次淡入上浮 ---- */

.auth-rise {
  animation: auth-rise 0.95s var(--lp-ease-spring) backwards;
  animation-delay: calc(var(--i, 0) * 80ms + 120ms);
}

@keyframes auth-rise {
  from {
    opacity: 0;
    filter: blur(10px);
    transform: translate3d(0, 20px, 0) scale(0.985);
  }
}

@keyframes auth-fade {
  from {
    opacity: 0;
  }
}

/* 在认证页之间切换时，左侧品牌区不再重复入场 */
.is-returning .auth-showcase .auth-rise,
.is-returning .auth-showcase .auth-headline-unit,
.is-returning .auth-bar {
  animation: none;
}

/* ---- 左侧品牌区 ---- */

.auth-showcase {
  display: none;
}

@media (min-width: 1024px) {
  .auth-showcase {
    display: block;
  }
}

.auth-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--lp-text);
}

.auth-brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: contain;
}

.auth-headline {
  margin-top: 28px;
  font-size: clamp(2.2rem, 3.6vw, 3.1rem);
  font-weight: 500;
  line-height: 1.12;
  letter-spacing: -0.035em;
  color: var(--lp-text);
}

.auth-headline-line {
  display: block;
}

.auth-headline-unit {
  display: inline-block;
  white-space: pre;
  animation: auth-unit 1.1s var(--lp-ease-out) backwards;
  animation-delay: calc(var(--i, 0) * 42ms + 200ms);
}

@keyframes auth-unit {
  from {
    opacity: 0;
    filter: blur(14px);
    transform: translate3d(0, 0.35em, 0);
  }
}

.auth-desc {
  max-width: 460px;
  margin-top: 18px;
}

.auth-orbit {
  max-width: 460px;
  margin-top: 24px;
}

.auth-points {
  display: grid;
  max-width: 460px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
  font-size: 14px;
  color: var(--lp-text-2);
}

.auth-points li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.auth-point-check {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: color-mix(in srgb, var(--lp-accent) 16%, transparent);
  color: var(--lp-accent);
}

/* ---- 右侧表单 ---- */

.auth-panel {
  width: 100%;
  max-width: 440px;
  margin-inline: auto;
}

/* 窄屏没有左侧品牌区，表单上方放一个紧凑的品牌头 */
.auth-panel-brand {
  min-height: 132px;
  margin-bottom: 24px;
  text-align: center;
}

@media (min-width: 1024px) {
  .auth-panel-brand {
    display: none;
  }
}

.auth-panel-logo {
  width: 56px;
  height: 56px;
  margin-inline: auto;
  border-radius: 16px;
  object-fit: contain;
  box-shadow: 0 16px 36px -14px var(--lp-glow-a);
  animation: auth-float 6s ease-in-out infinite;
}

@keyframes auth-float {
  50% {
    transform: translateY(-5px);
  }
}

.auth-panel-brand h1 {
  margin-top: 14px;
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.03em;
  color: var(--lp-text);
}

.auth-panel-brand p {
  margin-top: 4px;
  font-size: 13.5px;
  color: var(--lp-text-3);
}

.auth-card {
  border-radius: 28px;
  background-color: var(--lp-card-solid);
  box-shadow:
    var(--lp-shadow),
    0 0 90px -40px var(--lp-glow-a);
}

.auth-card-body {
  position: relative;
  padding: 32px 28px;
}

@media (min-width: 640px) {
  .auth-card-body {
    padding: 40px 36px;
  }
}

/* 卡片里的标题、表单各行、按钮依次浮现，比整张卡片一起出现更有层次 */
.auth-card-body :deep(> * > *),
.auth-card-body :deep(form > *) {
  animation: auth-rise 0.8s var(--lp-ease-spring) backwards;
  animation-delay: calc(var(--row, 0) * 55ms + 260ms);
}

.auth-card-body :deep(> * > *:nth-child(2)),
.auth-card-body :deep(form > *:nth-child(2)) {
  --row: 1;
}

.auth-card-body :deep(form > *:nth-child(3)) {
  --row: 2;
}

.auth-card-body :deep(form > *:nth-child(4)) {
  --row: 3;
}

.auth-card-body :deep(form > *:nth-child(5)) {
  --row: 4;
}

.auth-card-body :deep(form > *:nth-child(n + 6)) {
  --row: 5;
}

.auth-footer {
  margin-top: 22px;
  font-size: 14px;
  text-align: center;
  color: var(--lp-text-2);
}

.auth-copyright {
  margin-top: 28px;
  font-size: 12px;
  text-align: center;
  color: var(--lp-text-3);
}

@media (prefers-reduced-motion: reduce) {
  .auth-rise,
  .auth-bar,
  .auth-headline-unit,
  .auth-panel-logo,
  .auth-card-body :deep(> * > *),
  .auth-card-body :deep(form > *) {
    animation: none;
  }
}
</style>
