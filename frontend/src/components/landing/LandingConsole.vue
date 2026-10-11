<template>
  <!-- 一次请求经过网关的全过程：选模型 → 发请求 → 路由到上游 → 流式返回 -->
  <div ref="rootRef" class="terminal-container lp-console">
    <div class="lp-console-bar">
      <div class="lp-console-lights" aria-hidden="true"><span /><span /><span /></div>
      <div class="lp-console-endpoint lp-mono">
        <span class="lp-console-method">POST</span>
        <Transition name="lp-roll" mode="out-in">
          <span :key="active.endpoint" class="lp-console-path">{{ active.endpoint }}</span>
        </Transition>
      </div>
      <div class="lp-console-status" :data-phase="phase">
        <span class="lp-console-status-dot" />
        <Transition name="lp-roll" mode="out-in">
          <span :key="phase">{{ statusText }}</span>
        </Transition>
      </div>
    </div>

    <!-- 模型切换：选中项下方的高亮块滑到新位置，而不是闪现 -->
    <div ref="tabsRef" class="lp-console-models" role="tablist">
      <span class="lp-console-pill" :style="pillStyle" aria-hidden="true" />
      <button
        v-for="(model, index) in models"
        :key="model.id"
        :ref="(el) => setTabRef(el, index)"
        type="button"
        role="tab"
        class="lp-console-model"
        :class="{ 'is-active': index === activeIndex }"
        :aria-selected="index === activeIndex"
        @click="select(index, true)"
      >
        <span class="lp-console-icon"><ModelIcon :model="model.icon" size="14px" /></span>
        <span>{{ model.label }}</span>
      </button>
    </div>

    <div class="lp-console-body">
      <section class="lp-console-pane">
        <header class="lp-console-pane-head">{{ t('home.landing.console.request') }}</header>
        <pre class="lp-console-code lp-mono"><code><template v-for="(token, index) in requestTokens" :key="index"><span v-if="token.caret" class="lp-console-caret" /><span v-else :class="token.type && `tok-${token.type}`">{{ token.text }}</span></template></code></pre>
      </section>

      <section class="lp-console-pane lp-console-pane-response">
        <header class="lp-console-pane-head">
          <span>{{ t('home.landing.console.response') }}</span>
          <span class="lp-console-model-id lp-mono">{{ active.id }}</span>
        </header>
        <div class="lp-console-reply" aria-live="off">
          <p v-if="phase === 'typing' || phase === 'routing'" class="lp-console-waiting">
            <span class="lp-console-thinking"><span /><span /><span /></span>
            {{ t('home.landing.console.waiting') }}
          </p>
          <p v-else class="lp-console-text">
            {{ replyShown }}<span v-if="phase === 'streaming'" class="lp-console-caret" />
          </p>
        </div>
        <footer class="lp-console-usage lp-mono">
          <span>{{ t('home.landing.console.input') }} {{ inputTokens }}</span>
          <span class="lp-console-sep" />
          <span>{{ t('home.landing.console.output') }} {{ outputTokens }}</span>
          <span>tokens</span>
        </footer>
      </section>
    </div>

    <!-- 链路：请求从应用出发，经网关转到对应厂商 -->
    <div class="lp-console-route" :class="{ 'is-flowing': phase === 'routing' || phase === 'streaming' }">
      <span class="lp-console-node">{{ t('home.landing.console.client') }}</span>
      <span class="lp-console-beam" aria-hidden="true" />
      <span class="lp-console-node lp-console-node-gateway">
        <span class="lp-dot lp-dot-live" />
        {{ siteName }}
      </span>
      <span class="lp-console-beam" aria-hidden="true" />
      <Transition name="lp-roll" mode="out-in">
        <span :key="active.provider" class="lp-console-node">
          <span class="lp-console-icon"><ModelIcon :model="active.icon" size="12px" /></span>
          {{ active.provider }}
        </span>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelIcon from '@/components/common/ModelIcon.vue'
import { prefersReducedMotion, useInView } from './motion'

defineProps<{ siteName: string }>()

const { t } = useI18n()

type Phase = 'typing' | 'routing' | 'streaming' | 'done'

interface DemoModel {
  id: string
  label: string
  provider: string
  /** 交给 ModelIcon 匹配厂商图标的名字 */
  icon: string
  endpoint: string
  replyKey: string
  /** 该协议下的请求体；CARET 标记输入光标所在位置 */
  body: (prompt: string) => string
}

const CARET = '\u0001'

const chatBody = (model: string) => (prompt: string) =>
  `{
  "model": "${model}",
  "stream": true,
  "messages": [
    { "role": "user", "content": "${prompt}${CARET}" }
  ]
}`

// 三种原生协议各有一个代表：Anthropic Messages、OpenAI Chat Completions、Gemini
const models: DemoModel[] = [
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude',
    provider: 'Anthropic',
    icon: 'claude',
    endpoint: '/v1/messages',
    replyKey: 'claude',
    body: (prompt) =>
      `{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "stream": true,
  "messages": [
    { "role": "user", "content": "${prompt}${CARET}" }
  ]
}`
  },
  {
    id: 'gpt-5.5',
    label: 'GPT',
    provider: 'OpenAI',
    icon: 'gpt',
    endpoint: '/v1/chat/completions',
    replyKey: 'gpt',
    body: chatBody('gpt-5.5')
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini',
    provider: 'Google',
    icon: 'gemini',
    endpoint: '/v1beta/models/gemini-2.5-pro:streamGenerateContent',
    replyKey: 'gemini',
    body: (prompt) =>
      `{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "${prompt}${CARET}" }]
    }
  ]
}`
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek',
    provider: 'DeepSeek',
    icon: 'deepseek',
    endpoint: '/v1/chat/completions',
    replyKey: 'deepseek',
    body: chatBody('deepseek-v4-pro')
  }
]

const rootRef = ref<HTMLElement | null>(null)
const inView = useInView(rootRef)
const reducedMotion = prefersReducedMotion()

const activeIndex = ref(0)
const phase = ref<Phase>('typing')
const typed = ref(0)
const streamed = ref(0)

const active = computed(() => models[activeIndex.value])
const prompt = computed(() => t('home.landing.console.prompt'))
const reply = computed(() => t(`home.landing.console.replies.${active.value.replyKey}`))
const replyShown = computed(() => reply.value.slice(0, streamed.value))

const statusText = computed(() => {
  if (phase.value === 'done') return '200 OK'
  if (phase.value === 'streaming') return t('home.landing.console.streaming')
  if (phase.value === 'routing') return t('home.landing.console.routing')
  return t('home.landing.console.composing')
})

// 演示用的粗略计数，只为让数字随输出滚动
const inputTokens = computed(() => Math.max(1, Math.ceil(typed.value * 0.8)))
const outputTokens = computed(() => Math.ceil(streamed.value * 0.8))

// ---- 请求体着色 ----

interface CodeToken {
  text?: string
  type?: 'key' | 'string' | 'number' | 'literal' | 'punct'
  caret?: boolean
}

const TOKEN_PATTERN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|(true|false|null)|([{}[\],])|(\s+)/g

function tokenize(source: string, showCaret: boolean): CodeToken[] {
  const tokens: CodeToken[] = []
  for (const match of source.matchAll(TOKEN_PATTERN)) {
    const [, str, colon, num, literal, punct, space] = match
    if (str !== undefined) {
      const type = colon ? 'key' : 'string'
      const caretAt = str.indexOf(CARET)
      if (caretAt === -1) {
        tokens.push({ text: str, type })
      } else {
        tokens.push({ text: str.slice(0, caretAt), type })
        if (showCaret) tokens.push({ caret: true })
        tokens.push({ text: str.slice(caretAt + 1), type })
      }
      if (colon) tokens.push({ text: colon, type: 'punct' })
    } else if (num !== undefined) {
      tokens.push({ text: num, type: 'number' })
    } else if (literal !== undefined) {
      tokens.push({ text: literal, type: 'literal' })
    } else if (punct !== undefined) {
      tokens.push({ text: punct, type: 'punct' })
    } else if (space !== undefined) {
      tokens.push({ text: space })
    }
  }
  return tokens
}

const requestTokens = computed(() =>
  tokenize(active.value.body(prompt.value.slice(0, typed.value)), phase.value === 'typing')
)

// ---- 时间线 ----

let timer: ReturnType<typeof setTimeout> | undefined

function clearTimer() {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}

function schedule(delay: number) {
  clearTimer()
  timer = setTimeout(step, delay)
}

function step() {
  if (!inView.value) return
  if (phase.value === 'typing') {
    if (typed.value < prompt.value.length) {
      typed.value += 1
      schedule(34 + Math.random() * 46)
    } else {
      phase.value = 'routing'
      schedule(900)
    }
  } else if (phase.value === 'routing') {
    phase.value = 'streaming'
    schedule(80)
  } else if (phase.value === 'streaming') {
    if (streamed.value < reply.value.length) {
      // 每次吐 1–3 个字符，节奏略有起伏，更像真实的流式输出
      streamed.value = Math.min(reply.value.length, streamed.value + 1 + Math.floor(Math.random() * 3))
      schedule(26 + Math.random() * 44)
    } else {
      phase.value = 'done'
      schedule(3200)
    }
  } else {
    select((activeIndex.value + 1) % models.length, false)
  }
}

function showFinished() {
  typed.value = prompt.value.length
  streamed.value = reply.value.length
  phase.value = 'done'
}

function select(index: number, fromUser: boolean) {
  if (fromUser && index === activeIndex.value && phase.value !== 'done') return
  activeIndex.value = index
  if (reducedMotion) {
    showFinished()
    return
  }
  // 提示词只在首次进入时逐字敲出，之后切换模型直接从“路由”开始
  typed.value = prompt.value.length
  streamed.value = 0
  phase.value = 'routing'
  schedule(fromUser ? 620 : 760)
}

// ---- 选中项的滑动高亮 ----

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

// 切换语言后文案长度会变：把进度夹回新文案的范围内
watch([prompt, reply], () => {
  if (phase.value !== 'typing') typed.value = prompt.value.length
  if (phase.value === 'done') streamed.value = reply.value.length
  streamed.value = Math.min(streamed.value, reply.value.length)
  nextTick(updatePill)
})

watch(inView, (visible) => {
  if (reducedMotion) return
  if (visible) schedule(phase.value === 'typing' && typed.value === 0 ? 700 : 300)
  else clearTimer()
})

onMounted(() => {
  if (reducedMotion) showFinished()
  nextTick(updatePill)
  window.addEventListener('resize', updatePill)
})

onBeforeUnmount(() => {
  clearTimer()
  window.removeEventListener('resize', updatePill)
})
</script>

<style scoped>
/* 窗口本身在明暗两种主题下都是深色，像一张应用截图 */
.lp-console {
  --win-bg: #0c0d0f;
  --win-line: rgb(255 255 255 / 0.08);
  --win-text: #e8eaed;
  --win-text-2: #9aa0aa;
  --win-text-3: #6b717b;

  position: relative;
  width: 100%;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 20px;
  background:
    radial-gradient(120% 80% at 50% -20%, rgb(124 147 255 / 0.12), transparent 60%),
    var(--win-bg);
  color: var(--win-text);
  text-align: left;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 0 0 1px rgb(0 0 0 / 0.5),
    0 40px 100px -30px rgb(0 0 0 / 0.65),
    0 0 120px -40px var(--lp-glow-a);
}

.lp-console-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 46px;
  padding-inline: 16px;
  border-bottom: 1px solid var(--win-line);
}

.lp-console-lights {
  display: flex;
  flex-shrink: 0;
  gap: 7px;
}

.lp-console-lights span {
  width: 11px;
  height: 11px;
  border-radius: 9999px;
  background-color: rgb(255 255 255 / 0.14);
}

.lp-console:hover .lp-console-lights span:nth-child(1) {
  background-color: #ff5f57;
}

.lp-console:hover .lp-console-lights span:nth-child(2) {
  background-color: #febc2e;
}

.lp-console:hover .lp-console-lights span:nth-child(3) {
  background-color: #28c840;
}

.lp-console-lights span {
  transition: background-color 0.4s ease;
}

.lp-console-endpoint {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--win-text-2);
}

.lp-console-method {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 5px;
  background-color: rgb(124 147 255 / 0.16);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #a9b8ff;
}

.lp-console-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-console-status {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
  min-width: 84px;
  justify-content: flex-end;
  font-size: 12px;
  color: var(--win-text-2);
}

.lp-console-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: var(--win-text-3);
  transition: background-color 0.3s ease;
}

.lp-console-status[data-phase='routing'] .lp-console-status-dot {
  background-color: #fab219;
  animation: lp-console-blink 0.9s ease-in-out infinite;
}

.lp-console-status[data-phase='streaming'] .lp-console-status-dot {
  background-color: #7c93ff;
  animation: lp-console-blink 0.9s ease-in-out infinite;
}

.lp-console-status[data-phase='done'] .lp-console-status-dot {
  background-color: #28c840;
}

@keyframes lp-console-blink {
  50% {
    opacity: 0.35;
  }
}

/* ---- 模型切换 ---- */

.lp-console-models {
  position: relative;
  display: flex;
  gap: 2px;
  padding: 10px 12px;
  overflow-x: auto;
  border-bottom: 1px solid var(--win-line);
  scrollbar-width: none;
}

.lp-console-models::-webkit-scrollbar {
  display: none;
}

.lp-console-pill {
  position: absolute;
  top: 10px;
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

.lp-console-model {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding-inline: 12px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--win-text-2);
  transition: color 0.25s ease;
}

.lp-console-model:hover,
.lp-console-model.is-active {
  color: var(--win-text);
}

.lp-console-model:focus-visible {
  outline: 2px solid #7c93ff;
  outline-offset: 2px;
}

/* 厂商图标统一放在白底小圆角块里：品牌色里有纯黑，直接放在深色窗口上会看不见 */
.lp-console-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: #fff;
}

.lp-console-node .lp-console-icon {
  width: 17px;
  height: 17px;
  border-radius: 5px;
}

/* ---- 请求 / 响应 ---- */

.lp-console-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 768px) {
  .lp-console-body {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  }
}

.lp-console-pane {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 16px 18px 18px;
}

.lp-console-pane-response {
  border-top: 1px solid var(--win-line);
  background-color: rgb(255 255 255 / 0.015);
}

@media (min-width: 768px) {
  .lp-console-pane-response {
    border-top: 0;
    border-left: 1px solid var(--win-line);
  }
}

.lp-console-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--win-text-3);
}

.lp-console-model-id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
  text-transform: none;
}

.lp-console-code {
  margin: 0;
  min-height: 208px;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--win-text-2);
  white-space: pre;
  scrollbar-width: none;
}

.lp-console-code::-webkit-scrollbar {
  display: none;
}

.tok-key {
  color: #9db1ff;
}

.tok-string {
  color: #8fe3c8;
}

.tok-number,
.tok-literal {
  color: #f5c97a;
}

.tok-punct {
  color: var(--win-text-3);
}

.lp-console-caret {
  display: inline-block;
  width: 7px;
  height: 1.05em;
  margin-left: 1px;
  border-radius: 1.5px;
  background-color: #a9b8ff;
  vertical-align: text-bottom;
  animation: lp-caret 1.1s steps(1) infinite;
}

.lp-console-reply {
  min-height: 132px;
  flex: 1;
  font-size: 14px;
  line-height: 1.8;
}

.lp-console-text {
  color: var(--win-text);
  text-wrap: pretty;
}

.lp-console-waiting {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--win-text-3);
}

.lp-console-thinking {
  display: inline-flex;
  gap: 4px;
}

.lp-console-thinking span {
  width: 5px;
  height: 5px;
  border-radius: 9999px;
  background-color: currentColor;
  animation: lp-console-bounce 1.2s ease-in-out infinite;
}

.lp-console-thinking span:nth-child(2) {
  animation-delay: 0.15s;
}

.lp-console-thinking span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes lp-console-bounce {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.lp-console-usage {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px dashed var(--win-line);
  font-size: 11.5px;
  color: var(--win-text-3);
  font-variant-numeric: tabular-nums;
}

.lp-console-sep {
  width: 3px;
  height: 3px;
  border-radius: 9999px;
  background-color: currentColor;
  opacity: 0.6;
}

/* ---- 链路 ---- */

.lp-console-route {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid var(--win-line);
  font-size: 12px;
  color: var(--win-text-2);
}

.lp-console-node {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding-inline: 10px;
  border: 1px solid var(--win-line);
  border-radius: 9999px;
  background-color: rgb(255 255 255 / 0.03);
  white-space: nowrap;
}

.lp-console-node-gateway {
  border-color: rgb(124 147 255 / 0.35);
  background-color: rgb(124 147 255 / 0.1);
  color: var(--win-text);
}

.lp-console-beam {
  position: relative;
  min-width: 16px;
  height: 1px;
  flex: 1;
  overflow: hidden;
  background-color: var(--win-line);
}

/* 一小段光沿连线滑过，表示请求正在这条链路上传输 */
.lp-console-beam::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, #a9b8ff 50%, transparent);
  transform: translateX(-100%);
}

.lp-console-route.is-flowing .lp-console-beam::after {
  animation: lp-console-beam 1.1s linear infinite;
}

.lp-console-route.is-flowing .lp-console-beam:nth-of-type(4)::after {
  animation-delay: 0.35s;
}

@keyframes lp-console-beam {
  to {
    transform: translateX(100%);
  }
}

@media (max-width: 520px) {
  .lp-console-route {
    gap: 6px;
    padding-inline: 12px;
    font-size: 11px;
  }

  .lp-console-node {
    padding-inline: 8px;
  }

  .lp-console-status {
    min-width: 0;
  }
}

/* 文字换新时旧的上移淡出、新的自下而上滚入 */
.lp-roll-enter-active,
.lp-roll-leave-active {
  transition:
    opacity 0.28s var(--lp-ease-out),
    transform 0.28s var(--lp-ease-out),
    filter 0.28s var(--lp-ease-out);
}

.lp-roll-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(6px);
}

.lp-roll-leave-to {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(-6px);
}
</style>
