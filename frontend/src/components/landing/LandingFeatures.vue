<template>
  <section id="features" class="lp-section">
    <div class="lp-container">
      <header class="fx-head">
        <p v-reveal class="lp-eyebrow">{{ t('home.landing.features.eyebrow') }}</p>
        <h2 v-reveal="80" class="lp-h2">{{ t('home.landing.features.title') }}</h2>
        <p v-reveal="160" class="lp-lead">{{ t('home.landing.features.description') }}</p>
      </header>

      <!-- 四张等大的卡片：上半是文案，下半是一段可以直接上手点的产品演示，贴着卡片底边被裁切 -->
      <div v-spotlight class="fx-grid">
        <article v-reveal v-parallax class="lp-card fx-card">
          <span class="fx-index lp-mono" aria-hidden="true">01</span>
          <header class="fx-copy">
            <h3>{{ t('home.landing.features.oneKey.title') }}</h3>
            <p>{{ t('home.landing.features.oneKey.desc') }}</p>
          </header>
          <div class="fx-media"><DemoKeys /></div>
        </article>

        <article v-reveal="100" v-parallax class="lp-card fx-card">
          <span class="fx-index lp-mono" aria-hidden="true">02</span>
          <header class="fx-copy">
            <h3>{{ t('home.landing.features.routing.title') }}</h3>
            <p>{{ t('home.landing.features.routing.desc') }}</p>
          </header>
          <div class="fx-media"><DemoFailover :site-logo="siteLogo" /></div>
        </article>

        <article v-reveal v-parallax class="lp-card fx-card">
          <span class="fx-index lp-mono" aria-hidden="true">03</span>
          <header class="fx-copy">
            <h3>{{ t('home.landing.features.billing.title') }}</h3>
            <p>{{ t('home.landing.features.billing.desc') }}</p>
          </header>
          <div class="fx-media"><DemoUsage /></div>
        </article>

        <article v-reveal="100" v-parallax class="lp-card fx-card">
          <span class="fx-index lp-mono" aria-hidden="true">04</span>
          <header class="fx-copy">
            <h3>{{ t('home.landing.features.compat.title') }}</h3>
            <p>{{ t('home.landing.features.compat.desc') }}</p>
          </header>
          <div class="fx-media"><DemoClients :base-url="baseUrl" :site-name="siteName" /></div>
        </article>
      </div>

      <!-- 其余几项能力：不再套卡片，排成一行安静的清单 -->
      <ul class="fx-list">
        <li v-for="(item, index) in highlights" :key="item.key" v-reveal="index * 90" class="fx-item">
          <span class="fx-item-icon"><Icon :name="item.icon" size="sm" :stroke-width="1.8" /></span>
          <div>
            <h3>{{ t(`home.landing.features.${item.key}.title`) }}</h3>
            <p>{{ t(`home.landing.features.${item.key}.desc`) }}</p>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import DemoClients from './DemoClients.vue'
import DemoFailover from './DemoFailover.vue'
import DemoKeys from './DemoKeys.vue'
import DemoUsage from './DemoUsage.vue'
import { vParallax, vReveal, vSpotlight } from './motion'

defineProps<{
  baseUrl: string
  siteName: string
  siteLogo: string
}>()

const { t } = useI18n()

const highlights = [
  { key: 'stream', icon: 'bolt' },
  { key: 'sticky', icon: 'link' },
  { key: 'quota', icon: 'shield' }
] as const
</script>

<style scoped>
.fx-head {
  display: flex;
  max-width: 680px;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  margin: 0 auto clamp(40px, 6vw, 72px);
  text-align: center;
}

.fx-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}

@media (min-width: 900px) {
  .fx-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
  }
}

/* 卡片固定高度：四张对齐，演示区贴底被裁切 */
.fx-card {
  display: flex;
  min-width: 0;
  height: 540px;
  flex-direction: column;
  padding: 26px 22px 0;
  border-radius: 22px;
}

@media (min-width: 640px) {
  .fx-card {
    height: 552px;
    padding: 36px 36px 0;
  }
}

.fx-card:hover {
  border-color: var(--lp-line-strong);
}

/* 显现之后，卡片跟着指针轻微倾斜（--px / --py 由 v-parallax 写入）。
   悬停时去掉显现动画留下的延迟和慢速，倾斜才跟手 */
.fx-card.is-in {
  transform: perspective(1400px) rotateX(calc(var(--py, 0) * -1.4deg)) rotateY(calc(var(--px, 0) * 1.4deg));
}

.fx-card.is-in:hover {
  transition-delay: 0s;
  transition-duration: 0.35s;
}

/* 左上角一抹极淡的光，给平坦的卡面一点纵深 */
.fx-card {
  background-image: radial-gradient(
    120% 70% at 0% 0%,
    color-mix(in srgb, var(--lp-accent) 7%, transparent),
    transparent 60%
  );
}

.fx-index {
  position: absolute;
  top: 26px;
  right: 24px;
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--lp-text-3);
  opacity: 0.7;
}

@media (min-width: 640px) {
  .fx-index {
    top: 38px;
    right: 36px;
  }
}

/* 文案区给足两行说明的高度，相邻卡片的演示区才会从同一条线开始 */
.fx-copy {
  min-height: 88px;
  /* 给右上角的编号让出位置 */
  padding-right: 32px;
}

.fx-copy h3 {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--lp-text);
}

.fx-copy p {
  max-width: 30em;
  margin-top: 10px;
  font-size: 15px;
  line-height: 1.65;
  color: color-mix(in srgb, var(--lp-text) 58%, transparent);
  text-wrap: pretty;
}

.fx-media {
  position: relative;
  min-height: 0;
  flex: 1;
  margin-top: 22px;
}

/* 贴底的面板多往下伸一截：随指针位移时不会在卡片底边露出缝隙 */
.fx-media :deep(.fx-panel.fx-layer) {
  margin-bottom: -16px;
  padding-bottom: 16px;
}

/* ---- 其余能力清单 ---- */

.fx-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin-top: 28px;
}

.fx-item {
  display: flex;
  gap: 16px;
  padding: 24px 4px;
  border-top: 1px solid var(--lp-line);
}

@media (min-width: 900px) {
  .fx-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 40px;
  }

  .fx-item {
    padding: 4px 28px;
    border-top: 0;
    border-left: 1px solid var(--lp-line);
  }

  .fx-item:first-child {
    padding-left: 4px;
    border-left: 0;
  }
}

.fx-item-icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--lp-line);
  border-radius: 11px;
  background-color: var(--lp-inset);
  color: var(--lp-text);
  transition:
    transform 0.6s var(--lp-ease-spring),
    color 0.3s ease,
    border-color 0.3s ease;
}

.fx-item:hover .fx-item-icon {
  border-color: color-mix(in srgb, var(--lp-accent) 50%, transparent);
  color: var(--lp-accent);
  transform: translateY(-2px) rotate(-6deg);
}

.fx-item h3 {
  font-size: 15.5px;
  font-weight: 500;
  color: var(--lp-text);
}

.fx-item p {
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.65;
  color: color-mix(in srgb, var(--lp-text) 58%, transparent);
}
</style>
