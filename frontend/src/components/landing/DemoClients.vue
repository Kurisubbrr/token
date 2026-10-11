<template>
  <!-- 各家客户端的接入配置：只有接口地址那一行不同于官方，切换标签时把它重新敲一遍 -->
  <div ref="rootRef" class="clients">
    <div class="clients-window fx-panel fx-layer" style="--depth: 5">
      <div class="clients-bar">
        <div class="clients-tabs" role="tablist">
          <span class="clients-pill" :style="pillStyle" aria-hidden="true" />
          <button
            v-for="(client, index) in clients"
            :key="client.id"
            :ref="(el) => setTabRef(el, index)"
            type="button"
            role="tab"
            class="clients-tab"
            :class="{ 'is-active': index === activeIndex }"
            :aria-selected="index === activeIndex"
            @click="select(index, true)"
          >
            {{ client.label }}
          </button>
        </div>
        <button
          type="button"
          class="clients-copy"
          :class="{ 'is-copied': copied }"
          :aria-label="copied ? t('home.landing.quickstart.copied') : t('home.landing.quickstart.copy')"
          @click="copy"
        >
          <span class="clients-copy-icon">
            <Icon name="copy" size="sm" class="icon-copy" />
            <Icon name="check" size="sm" :stroke-width="2.25" class="icon-check" />
          </span>
        </button>
      </div>

      <p class="clients-file lp-mono">{{ active.file }}</p>

      <pre :key="active.id" class="clients-code lp-mono"><code><span
        v-for="(line, lineIndex) in active.lines"
        :key="lineIndex"
        class="clients-line"
        :class="{ 'is-key': line.url !== undefined }"
        :style="{ '--i': lineIndex }"
      ><span class="clients-ln">{{ lineIndex + 1 }}</span><template v-if="line.url !== undefined"><span class="tok-var">{{ line.name }}</span><span class="tok-op">{{ line.assign }}</span><span class="tok-str">"{{ typedUrl(line.url) }}<span v-if="typing" class="clients-caret" />"</span>{{ line.tail }}</template><template v-else>{{ line.text }}</template></span></code></pre>

      <div class="clients-status" :class="{ 'is-ready': !typing }">
        <span class="clients-status-dot" />
        {{ t('home.landing.features.compat.connected', { name: siteName }) }}
        <span class="clients-status-code lp-mono">200 OK</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { prefersReducedMotion, useInView } from './motion'

const props = defineProps<{
  baseUrl: string
  siteName: string
}>()

const { t } = useI18n()

interface CodeLine {
  /** 普通行的全文 */
  text?: string
  /** 接口地址行：变量名、赋值符号、地址、行尾 */
  name?: string
  assign?: string
  url?: string
  tail?: string
}

interface Client {
  id: string
  label: string
  file: string
  lines: CodeLine[]
}

// 配置写法与控制台“使用密钥”弹窗里给出的一致
const clients = computed<Client[]>(() => {
  const base = props.baseUrl
  return [
    {
      id: 'claude-code',
      label: 'Claude Code',
      file: t('home.landing.features.compat.terminal'),
      lines: [
        { name: 'export ANTHROPIC_BASE_URL', assign: '=', url: base, tail: '' },
        { text: 'export ANTHROPIC_AUTH_TOKEN="sk-..."' },
        { text: '' },
        { text: 'claude' }
      ]
    },
    {
      id: 'codex',
      label: 'Codex CLI',
      file: '~/.codex/config.toml',
      lines: [
        { text: 'model_provider = "OpenAI"' },
        { text: 'model = "gpt-5.5"' },
        { text: '' },
        { text: '[model_providers.OpenAI]' },
        { name: 'base_url', assign: ' = ', url: `${base}/v1`, tail: '' },
        { text: 'wire_api = "responses"' }
      ]
    },
    {
      id: 'gemini-cli',
      label: 'Gemini CLI',
      file: t('home.landing.features.compat.terminal'),
      lines: [
        { name: 'export GOOGLE_GEMINI_BASE_URL', assign: '=', url: base, tail: '' },
        { text: 'export GEMINI_API_KEY="sk-..."' },
        { text: '' },
        { text: 'gemini' }
      ]
    },
    {
      id: 'openai-sdk',
      label: 'OpenAI SDK',
      file: 'app.py',
      lines: [
        { text: 'from openai import OpenAI' },
        { text: '' },
        { text: 'client = OpenAI(' },
        { name: '    base_url', assign: '=', url: `${base}/v1`, tail: ',' },
        { text: '    api_key="sk-...",' },
        { text: ')' }
      ]
    }
  ]
})

const activeIndex = ref(0)
const active = computed(() => clients.value[activeIndex.value])

// ---- 接口地址逐字敲出 ----

const typedCount = ref(0)
const typing = ref(false)
const typedUrl = (url: string) => (typing.value ? url.slice(0, typedCount.value) : url)
const activeUrl = computed(() => active.value.lines.find((line) => line.url !== undefined)?.url ?? '')

let typeTimer: ReturnType<typeof setTimeout> | undefined

function typeNext() {
  if (typedCount.value >= activeUrl.value.length) {
    typing.value = false
    return
  }
  typedCount.value += 1
  typeTimer = setTimeout(typeNext, 16 + Math.random() * 26)
}

function startTyping() {
  clearTimeout(typeTimer)
  if (prefersReducedMotion()) {
    typing.value = false
    return
  }
  typing.value = true
  typedCount.value = 0
  // 等各行浮现得差不多了再开始敲
  typeTimer = setTimeout(typeNext, 380)
}

// ---- 切换 ----

const AUTOPLAY_MS = 5200
const USER_PAUSE_MS = 12000
let pausedUntil = 0
let autoplay: ReturnType<typeof setInterval> | undefined

function select(index: number, fromUser: boolean) {
  if (fromUser) pausedUntil = Date.now() + USER_PAUSE_MS
  if (index === activeIndex.value) return
  activeIndex.value = index
  startTyping()
}

const rootRef = ref<HTMLElement | null>(null)
const inView = useInView(rootRef)
let played = false

watch(
  inView,
  (visible) => {
    clearInterval(autoplay)
    if (!visible || prefersReducedMotion()) return
    // 第一次滚进视口时把当前这段演示播一遍
    if (!played) {
      played = true
      startTyping()
    }
    autoplay = setInterval(() => {
      if (Date.now() < pausedUntil) return
      select((activeIndex.value + 1) % clients.value.length, false)
    }, AUTOPLAY_MS)
  },
  { immediate: true }
)

// ---- 复制 ----

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const snippet = computed(() =>
  active.value.lines
    .map((line) => (line.url !== undefined ? `${line.name}${line.assign}"${line.url}"${line.tail}` : line.text))
    .join('\n')
)

async function copy() {
  pausedUntil = Date.now() + USER_PAUSE_MS
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(snippet.value)
    } else {
      // 非 HTTPS 环境下没有 Clipboard API，退回到选中文本再复制
      const textarea = document.createElement('textarea')
      textarea.value = snippet.value
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

onMounted(() => {
  nextTick(updatePill)
  window.addEventListener('resize', updatePill)
})

onBeforeUnmount(() => {
  clearInterval(autoplay)
  clearTimeout(typeTimer)
  clearTimeout(copiedTimer)
  window.removeEventListener('resize', updatePill)
})
</script>

<style scoped>
.clients {
  display: flex;
  height: 100%;
  flex-direction: column;
}

/* 一扇贴着卡片底边的编辑器窗口 */
.clients-window {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
}

.clients-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--lp-line);
}

.clients-tabs {
  position: relative;
  display: flex;
  min-width: 0;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.clients-tabs::-webkit-scrollbar {
  display: none;
}

.clients-pill {
  position: absolute;
  top: 0;
  left: 0;
  height: 30px;
  border-radius: 9px;
  background-color: var(--lp-inset);
  box-shadow: inset 0 0 0 1px var(--lp-line);
  transition:
    transform 0.55s var(--lp-ease-spring),
    width 0.55s var(--lp-ease-spring),
    opacity 0.3s ease;
}

.clients-tab {
  position: relative;
  flex-shrink: 0;
  height: 30px;
  padding-inline: 11px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--lp-text-3);
  transition: color 0.25s ease;
}

.clients-tab:hover,
.clients-tab.is-active {
  color: var(--lp-text);
}

.clients-tab:focus-visible,
.clients-copy:focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: 2px;
}

.clients-copy {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--lp-text-3);
  transition:
    color 0.25s ease,
    background-color 0.25s ease,
    transform 0.4s var(--lp-ease-spring);
}

.clients-copy:hover {
  background-color: var(--lp-inset);
  color: var(--lp-text);
}

.clients-copy:active {
  transform: scale(0.9);
}

.clients-copy.is-copied {
  color: var(--lp-good);
}

.clients-copy-icon {
  position: relative;
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.clients-copy-icon > * {
  position: absolute;
  inset: 0;
  transition:
    opacity 0.3s ease,
    transform 0.5s var(--lp-ease-spring);
}

.clients-copy-icon .icon-check {
  opacity: 0;
  transform: scale(0.4) rotate(-40deg);
}

.is-copied .clients-copy-icon .icon-copy {
  opacity: 0;
  transform: scale(0.4) rotate(40deg);
}

.is-copied .clients-copy-icon .icon-check {
  opacity: 1;
  transform: none;
}

.clients-file {
  padding: 12px 16px 0;
  font-size: 11.5px;
  color: var(--lp-text-3);
}

.clients-code {
  flex: 1;
  margin: 0;
  padding: 8px 0 12px;
  /* 接口地址较长时允许横向滑动查看，而不是被窗口边缘截断 */
  overflow: auto hidden;
  font-size: 12px;
  line-height: 1.9;
  color: var(--lp-text-2);
  white-space: pre;
  scrollbar-width: none;
}

.clients-code::-webkit-scrollbar {
  display: none;
}

.clients-code code {
  display: block;
  width: max-content;
  min-width: 100%;
}

.clients-line {
  position: relative;
  display: block;
  padding-right: 16px;
  animation: clients-line 0.55s var(--lp-ease-out) backwards;
  animation-delay: calc(var(--i) * 32ms);
}

@keyframes clients-line {
  from {
    opacity: 0;
    filter: blur(4px);
    transform: translateX(-8px);
  }
}

/* 唯一需要改动的那一行：左侧一道强调色竖条，整行浅浅地亮起来 */
.clients-line.is-key {
  background-color: color-mix(in srgb, var(--lp-accent) 9%, transparent);
  color: var(--lp-text);
}

.clients-line.is-key::before {
  content: '';
  position: absolute;
  inset-block: 3px;
  left: 0;
  width: 2px;
  border-radius: 2px;
  background-color: var(--lp-accent);
}

.clients-ln {
  display: inline-block;
  width: 36px;
  padding-right: 12px;
  text-align: right;
  color: var(--lp-text-3);
  opacity: 0.6;
  user-select: none;
}

.tok-var {
  color: var(--lp-accent);
}

.tok-op {
  color: var(--lp-text-3);
}

.tok-str {
  color: var(--lp-text);
}

.clients-caret {
  display: inline-block;
  width: 6px;
  height: 1.05em;
  margin-left: 1px;
  border-radius: 1.5px;
  background-color: var(--lp-accent);
  vertical-align: text-bottom;
  animation: lp-caret 1.1s steps(1) infinite;
}

/* 地址敲完后，底部状态条亮起 */
.clients-status {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding-inline: 16px;
  border-top: 1px solid var(--lp-line);
  font-size: 12px;
  color: var(--lp-text-3);
  transition: color 0.4s ease;
}

.clients-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--lp-text-3);
  transition:
    background-color 0.4s ease,
    box-shadow 0.6s ease;
}

.clients-status-code {
  margin-left: auto;
  opacity: 0;
  transform: translateX(6px);
  transition:
    opacity 0.4s ease,
    transform 0.5s var(--lp-ease-spring);
}

.clients-status.is-ready {
  color: var(--lp-text);
}

.clients-status.is-ready .clients-status-dot {
  background-color: var(--lp-good);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--lp-good) 22%, transparent);
}

.clients-status.is-ready .clients-status-code {
  opacity: 1;
  transform: none;
}
</style>
