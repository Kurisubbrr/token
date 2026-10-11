<template>
  <section id="quickstart" class="lp-section quickstart">
    <div class="lp-container quickstart-grid">
      <div class="quickstart-copy">
        <p v-reveal class="lp-eyebrow">{{ t('home.landing.quickstart.eyebrow') }}</p>
        <h2 v-reveal="80" class="lp-h2">{{ t('home.landing.quickstart.title') }}</h2>

        <!-- 步骤左侧的进度线随页面滚动逐段填满，走到哪一步，哪一步点亮 -->
        <ol ref="stepsRef" class="quickstart-steps" :style="{ '--progress': progress }">
          <li
            v-for="(step, index) in steps"
            :key="step"
            v-reveal="index * 100"
            class="quickstart-step"
            :class="{ 'is-reached': progress >= reachAt(index) }"
          >
            <span class="quickstart-step-index lp-mono">{{ index + 1 }}</span>
            <div>
              <h3>{{ t(`home.landing.quickstart.steps.${step}.title`) }}</h3>
              <p>{{ t(`home.landing.quickstart.steps.${step}.desc`) }}</p>
            </div>
          </li>
        </ol>
      </div>

      <div v-reveal="160" class="quickstart-window">
        <div class="quickstart-bar">
          <div ref="tabsRef" class="quickstart-tabs" role="tablist">
            <span class="quickstart-pill" :style="pillStyle" aria-hidden="true" />
            <button
              v-for="(sample, index) in samples"
              :key="sample.id"
              :ref="(el) => setTabRef(el, index)"
              type="button"
              role="tab"
              class="quickstart-tab"
              :class="{ 'is-active': index === activeIndex }"
              :aria-selected="index === activeIndex"
              @click="activeIndex = index"
            >
              {{ sample.label }}
            </button>
          </div>

          <button
            type="button"
            class="quickstart-copy-btn"
            :class="{ 'is-copied': copied }"
            :aria-label="copied ? t('home.landing.quickstart.copied') : t('home.landing.quickstart.copy')"
            @click="copy"
          >
            <!-- 复制成功后图标原地换成对勾 -->
            <span class="quickstart-copy-icon">
              <Icon name="copy" size="sm" class="icon-copy" />
              <Icon name="check" size="sm" :stroke-width="2.25" class="icon-check" />
            </span>
            <span>{{ copied ? t('home.landing.quickstart.copied') : t('home.landing.quickstart.copy') }}</span>
          </button>
        </div>

        <p class="quickstart-note lp-mono">{{ active.note }}</p>

        <!-- 切换示例时各行依次浮现 -->
        <pre :key="active.id" class="quickstart-code lp-mono"><code><span
          v-for="(line, lineIndex) in highlighted"
          :key="lineIndex"
          class="quickstart-line"
          :style="{ '--i': lineIndex }"
        ><span class="quickstart-ln">{{ lineIndex + 1 }}</span><span
          v-for="(token, tokenIndex) in line"
          :key="tokenIndex"
          :class="token.type && `tok-${token.type}`"
        >{{ token.text }}</span></span></code></pre>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { prefersReducedMotion, vReveal } from './motion'

const props = defineProps<{ baseUrl: string }>()

const { t } = useI18n()

const steps = ['signup', 'key', 'call'] as const

// ---- 示例代码 ----

interface Sample {
  id: string
  label: string
  note: string
  code: string
}

const samples = computed<Sample[]>(() => {
  const base = props.baseUrl
  const hello = t('home.landing.quickstart.hello')
  return [
    {
      id: 'curl',
      label: 'cURL',
      note: 'POST /v1/chat/completions',
      code: `curl ${base}/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.5",
    "messages": [
      { "role": "user", "content": "${hello}" }
    ]
  }'`
    },
    {
      id: 'python',
      label: 'Python',
      note: 'OpenAI SDK',
      code: `from openai import OpenAI

client = OpenAI(
    base_url="${base}/v1",
    api_key="sk-...",
)

reply = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{"role": "user", "content": "${hello}"}],
)
print(reply.choices[0].message.content)`
    },
    {
      id: 'node',
      label: 'Node.js',
      note: 'Anthropic SDK',
      code: `import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  baseURL: '${base}',
  apiKey: 'sk-...',
})

const reply = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: '${hello}' }],
})
console.log(reply.content[0].text)`
    }
  ]
})

const activeIndex = ref(0)
const active = computed(() => samples.value[activeIndex.value])

// ---- 极简着色：只区分字符串、关键字和命令行参数，够读就行 ----

interface CodeToken {
  text: string
  type?: 'string' | 'keyword' | 'flag'
}

const TOKEN_PATTERN =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(from|import|const|await|new|print|curl)\b|(\s-[Hd]\b)/g

function highlightLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = []
  let last = 0
  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0
    if (index > last) tokens.push({ text: line.slice(last, index) })
    const type = match[1] !== undefined ? 'string' : match[2] !== undefined ? 'keyword' : 'flag'
    tokens.push({ text: match[0], type })
    last = index + match[0].length
  }
  if (last < line.length) tokens.push({ text: line.slice(last) })
  return tokens
}

const highlighted = computed(() => active.value.code.split('\n').map(highlightLine))

// ---- 复制 ----

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  const text = active.value.code
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // 非 HTTPS 环境下没有 Clipboard API，退回到选中文本再复制
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', 'true')
      textarea.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
    }, 1800)
  } catch {
    copied.value = false
  }
}

// ---- 选中标签的滑动高亮 ----

const tabsRef = ref<HTMLElement | null>(null)
const tabRefs: (HTMLElement | null)[] = []
const pillStyle = ref<Record<string, string>>({ opacity: '0' })

function setTabRef(el: unknown, index: number) {
  tabRefs[index] = el instanceof HTMLElement ? el : null
}

function updatePill() {
  const tab = tabRefs[activeIndex.value]
  if (!tab) return
  pillStyle.value = {
    opacity: '1',
    width: `${tab.offsetWidth}px`,
    transform: `translateX(${tab.offsetLeft}px)`
  }
}

watch(activeIndex, () => nextTick(updatePill))

// ---- 步骤进度：跟随滚动 ----

const stepsRef = ref<HTMLElement | null>(null)
const progress = ref(0)

// 第 n 步在进度走到它的序号圆点时点亮
const reachAt = (index: number) => (index + 0.25) / steps.length

function updateProgress() {
  const el = stepsRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const viewport = window.innerHeight || 1
  // 以视口 70% 高度处为“阅读线”，它扫过列表的比例就是进度
  const value = (viewport * 0.7 - rect.top) / Math.max(1, rect.height)
  progress.value = Math.min(1, Math.max(0, value))
}

onMounted(() => {
  nextTick(updatePill)
  window.addEventListener('resize', updatePill)
  if (prefersReducedMotion()) {
    progress.value = 1
    return
  }
  updateProgress()
  window.addEventListener('scroll', updateProgress, { passive: true })
  window.addEventListener('resize', updateProgress)
})

onBeforeUnmount(() => {
  clearTimeout(copiedTimer)
  window.removeEventListener('resize', updatePill)
  window.removeEventListener('scroll', updateProgress)
  window.removeEventListener('resize', updateProgress)
})
</script>

<style scoped>
.quickstart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}

@media (min-width: 960px) {
  .quickstart-grid {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 72px;
  }

  .quickstart-window {
    position: sticky;
    top: 112px;
  }
}

.quickstart-copy .lp-h2 {
  margin-top: 18px;
}

/* ---- 步骤 ---- */

.quickstart-steps {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 36px;
  margin-top: 48px;
}

/* 轨道与已走过的部分 */
.quickstart-steps::before,
.quickstart-steps::after {
  content: '';
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 17px;
  width: 2px;
  border-radius: 2px;
}

.quickstart-steps::before {
  background-color: var(--lp-line);
}

.quickstart-steps::after {
  background: linear-gradient(to bottom, var(--lp-accent), var(--lp-accent-2));
  transform: scaleY(var(--progress, 0));
  transform-origin: top;
  transition: transform 0.25s linear;
}

.quickstart-step {
  position: relative;
  display: flex;
  gap: 20px;
}

.quickstart-step-index {
  position: relative;
  z-index: 1;
  display: flex;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--lp-line-strong);
  border-radius: 9999px;
  background-color: var(--lp-bg);
  font-size: 13px;
  color: var(--lp-text-3);
  transition:
    background-color 0.5s ease,
    border-color 0.5s ease,
    color 0.5s ease,
    transform 0.6s var(--lp-ease-spring),
    box-shadow 0.5s ease;
}

.quickstart-step.is-reached .quickstart-step-index {
  border-color: transparent;
  background-color: var(--lp-accent);
  color: #fff;
  transform: scale(1.08);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--lp-accent) 16%, transparent);
}

.quickstart-step h3 {
  padding-top: 5px;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--lp-text-3);
  transition: color 0.5s ease;
}

.quickstart-step.is-reached h3 {
  color: var(--lp-text);
}

.quickstart-step p {
  margin-top: 8px;
  font-size: 15px;
  line-height: 1.7;
  color: var(--lp-text-2);
}

/* ---- 代码窗口（明暗主题下都是深色） ---- */

.quickstart-window {
  --win-line: rgb(255 255 255 / 0.08);
  --win-text: #e8eaed;
  --win-text-2: #9aa0aa;
  --win-text-3: #6b717b;

  min-width: 0;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 20px;
  background-color: #0c0d0f;
  color: var(--win-text);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 30px 80px -30px rgb(0 0 0 / 0.6);
}

.quickstart-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--win-line);
}

.quickstart-tabs {
  position: relative;
  display: flex;
  gap: 2px;
}

.quickstart-pill {
  position: absolute;
  top: 0;
  left: 0;
  height: 32px;
  border-radius: 10px;
  background-color: rgb(255 255 255 / 0.09);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08);
  transition:
    transform 0.55s var(--lp-ease-spring),
    width 0.55s var(--lp-ease-spring),
    opacity 0.3s ease;
}

.quickstart-tab {
  position: relative;
  height: 32px;
  padding-inline: 14px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--win-text-2);
  transition: color 0.25s ease;
}

.quickstart-tab:hover,
.quickstart-tab.is-active {
  color: var(--win-text);
}

.quickstart-tab:focus-visible,
.quickstart-copy-btn:focus-visible {
  outline: 2px solid #7c93ff;
  outline-offset: 2px;
}

.quickstart-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding-inline: 12px;
  border: 1px solid var(--win-line);
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--win-text-2);
  transition:
    color 0.25s ease,
    border-color 0.25s ease,
    background-color 0.25s ease,
    transform 0.4s var(--lp-ease-spring);
}

.quickstart-copy-btn:hover {
  border-color: rgb(255 255 255 / 0.18);
  background-color: rgb(255 255 255 / 0.05);
  color: var(--win-text);
}

.quickstart-copy-btn:active {
  transform: scale(0.95);
}

.quickstart-copy-btn.is-copied {
  border-color: rgb(40 200 64 / 0.4);
  color: #6ee787;
}

.quickstart-copy-icon {
  position: relative;
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.quickstart-copy-icon > * {
  position: absolute;
  inset: 0;
  transition:
    opacity 0.3s ease,
    transform 0.5s var(--lp-ease-spring);
}

.quickstart-copy-icon .icon-check {
  opacity: 0;
  transform: scale(0.4) rotate(-40deg);
}

.is-copied .quickstart-copy-icon .icon-copy {
  opacity: 0;
  transform: scale(0.4) rotate(40deg);
}

.is-copied .quickstart-copy-icon .icon-check {
  opacity: 1;
  transform: none;
}

.quickstart-note {
  padding: 14px 20px 0;
  font-size: 11.5px;
  color: var(--win-text-3);
}

.quickstart-code {
  margin: 0;
  min-height: 316px;
  padding: 12px 20px 22px 0;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.8;
  color: var(--win-text);
  scrollbar-width: none;
}

.quickstart-code::-webkit-scrollbar {
  display: none;
}

.quickstart-line {
  display: block;
  animation: quickstart-line 0.6s var(--lp-ease-out) both;
  animation-delay: calc(var(--i) * 28ms);
}

@keyframes quickstart-line {
  from {
    opacity: 0;
    filter: blur(4px);
    transform: translateX(-8px);
  }
}

.quickstart-ln {
  display: inline-block;
  width: 44px;
  padding-right: 16px;
  text-align: right;
  color: var(--win-text-3);
  opacity: 0.6;
  user-select: none;
}

.tok-string {
  color: #8fe3c8;
}

.tok-keyword {
  color: #9db1ff;
}

.tok-flag {
  color: #f5c97a;
}
</style>
