<template>
  <section id="faq" class="lp-section faq">
    <div class="lp-container faq-grid">
      <header class="faq-head">
        <p v-reveal class="lp-eyebrow">{{ t('home.landing.faq.eyebrow') }}</p>
        <h2 v-reveal="80" class="lp-h2">{{ t('home.landing.faq.title') }}</h2>
        <p v-reveal="160" class="lp-lead">{{ t('home.landing.faq.lead') }}</p>
      </header>

      <ul v-spotlight class="faq-list">
        <li
          v-for="(item, index) in items"
          :key="item"
          v-reveal="index * 70"
          class="lp-card faq-item"
          :class="{ 'is-open': open === index }"
        >
          <h3>
            <button
              :id="`faq-q-${item}`"
              type="button"
              class="faq-question"
              :aria-expanded="open === index"
              :aria-controls="`faq-a-${item}`"
              @click="open = open === index ? -1 : index"
            >
              <span class="faq-index lp-mono" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="faq-question-text">{{ t(`home.landing.faq.items.${item}.q`, { siteName }) }}</span>
              <span class="faq-toggle" aria-hidden="true"></span>
            </button>
          </h3>
          <!-- 高度用 grid 行从 0fr 过渡到 1fr：不必量内容高度，也不会在换行时错位 -->
          <div :id="`faq-a-${item}`" class="faq-answer" role="region" :aria-labelledby="`faq-q-${item}`">
            <div class="faq-answer-inner">
              <p>{{ t(`home.landing.faq.items.${item}.a`, { siteName }) }}</p>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { vReveal, vSpotlight } from './motion'

defineProps<{ siteName: string }>()

const { t } = useI18n()

// 问答的文案在 i18n/locales/{zh,en}/landing.ts 的 home.landing.faq.items 里，增删问题改这份清单和文案即可
const items = ['what', 'connect', 'models', 'billing', 'failover', 'limits'] as const

const open = ref(0)
</script>

<style scoped>
.faq-grid {
  display: grid;
  gap: 40px;
}

@media (min-width: 1024px) {
  .faq-grid {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 72px;
  }

  /* 左侧标题在滚动时停在原处，右侧问题一条条经过 */
  .faq-head {
    position: sticky;
    top: 120px;
    align-self: start;
  }
}

.faq-head .lp-lead {
  margin-top: 16px;
}

.faq-list {
  display: grid;
  gap: 12px;
}

.faq-item {
  border-radius: 18px;
  transition:
    border-color 0.3s ease,
    background-color 0.3s ease;
}

.faq-item.is-open {
  border-color: var(--lp-line-strong);
}

.faq-question {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 16px;
  padding: 20px 22px;
  text-align: left;
}

.faq-index {
  flex: none;
  color: var(--lp-text-3);
  font-size: 12px;
  transition: color 0.3s ease;
}

.faq-item.is-open .faq-index {
  color: var(--lp-accent);
}

.faq-question-text {
  flex: 1;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
}

/* 加号：展开时竖线转平，变成减号 */
.faq-toggle {
  position: relative;
  width: 28px;
  height: 28px;
  flex: none;
  border: 1px solid var(--lp-line);
  border-radius: 50%;
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease,
    transform 0.5s var(--lp-ease-spring);
}

.faq-toggle::before,
.faq-toggle::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 1.5px;
  margin: -0.75px 0 0 -5px;
  border-radius: 1px;
  background: currentColor;
  content: '';
  transition: transform 0.5s var(--lp-ease-spring);
}

.faq-toggle::after {
  transform: rotate(90deg);
}

.faq-question:hover .faq-toggle {
  border-color: var(--lp-line-strong);
}

.faq-item.is-open .faq-toggle {
  border-color: transparent;
  background: var(--lp-cta-bg);
  color: var(--lp-cta-text);
  transform: rotate(180deg);
}

.faq-item.is-open .faq-toggle::after {
  transform: rotate(0deg);
}

.faq-answer {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.55s var(--lp-ease-spring);
}

.faq-item.is-open .faq-answer {
  grid-template-rows: 1fr;
}

.faq-answer-inner {
  min-height: 0;
  overflow: hidden;
  visibility: hidden;
  opacity: 0;
  transition:
    opacity 0.3s ease,
    visibility 0s linear 0.55s;
}

.faq-item.is-open .faq-answer-inner {
  visibility: visible;
  opacity: 1;
  transition:
    opacity 0.5s ease 0.1s,
    visibility 0s;
}

.faq-answer p {
  padding: 0 22px 22px 60px;
  color: var(--lp-text-2);
  font-size: 15px;
  line-height: 1.8;
}

@media (max-width: 639px) {
  .faq-answer p {
    padding-left: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .faq-answer,
  .faq-answer-inner,
  .faq-toggle,
  .faq-toggle::before,
  .faq-toggle::after {
    transition: none;
  }
}
</style>
