<template>
  <!-- 一把密钥居中，各家模型绕着它转 -->
  <div ref="rootRef" class="orbit" :class="{ 'is-paused': !inView }">
    <div
      v-for="ring in rings"
      :key="ring.id"
      class="orbit-ring"
      :class="`orbit-ring-${ring.id}`"
    >
      <span
        v-for="(model, index) in ring.models"
        :key="model.id"
        class="orbit-sat"
        :style="{ '--angle': `${(360 / ring.models.length) * index + ring.offset}deg` }"
      >
        <span class="orbit-sat-upright">
          <span class="orbit-sat-spin">
            <span
              class="orbit-tile"
              :class="{ 'is-active': model.id === current.id }"
              :title="model.label"
            >
              <ModelIcon :model="model.icon" size="20px" />
            </span>
          </span>
        </span>
      </span>
    </div>

    <div class="orbit-core">
      <span class="orbit-core-pulse" aria-hidden="true" />
      <Icon name="key" size="md" :stroke-width="1.75" />
    </div>

    <div class="orbit-code lp-mono">
      <span class="orbit-code-key">model</span>
      <span class="orbit-code-punct">:</span>
      <Transition name="orbit-roll" mode="out-in">
        <span :key="current.id" class="orbit-code-value">"{{ current.id }}"</span>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ModelIcon from '@/components/common/ModelIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import { prefersReducedMotion, useInView } from './motion'

interface OrbitModel {
  id: string
  label: string
  icon: string
}

const rings: { id: 'inner' | 'outer'; offset: number; models: OrbitModel[] }[] = [
  {
    id: 'inner',
    offset: -90,
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude', icon: 'claude' },
      { id: 'gpt-5.5', label: 'GPT', icon: 'gpt' },
      { id: 'gemini-2.5-pro', label: 'Gemini', icon: 'gemini' }
    ]
  },
  {
    id: 'outer',
    offset: -54,
    models: [
      { id: 'deepseek-v4-pro', label: 'DeepSeek', icon: 'deepseek' },
      { id: 'grok-4.6', label: 'Grok', icon: 'grok' },
      { id: 'kimi-k3', label: 'Kimi', icon: 'kimi' },
      { id: 'glm-5.3', label: 'GLM', icon: 'glm' },
      { id: 'MiniMax-M3', label: 'MiniMax', icon: 'minimax' }
    ]
  }
]

// 代码里的 model 值按内外圈交替轮换，对应的图标同步点亮
const sequence = [0, 3, 1, 4, 2, 5, 6, 7].map((index) => [...rings[0].models, ...rings[1].models][index])

const rootRef = ref<HTMLElement | null>(null)
const inView = useInView(rootRef)
const cursor = ref(0)
const current = computed(() => sequence[cursor.value])

let timer: ReturnType<typeof setInterval> | undefined

watch(
  inView,
  (visible) => {
    clearInterval(timer)
    if (visible && !prefersReducedMotion()) {
      timer = setInterval(() => {
        cursor.value = (cursor.value + 1) % sequence.length
      }, 2200)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.orbit {
  --inner: 96px;
  --outer: 168px;

  position: relative;
  display: grid;
  height: 300px;
  place-items: center;
  /* 外圈上下略超出卡片，用遮罩让它自然淡出 */
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 80%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 80%, transparent);
}

.orbit-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px dashed var(--lp-line-strong);
  border-radius: 50%;
  animation: orbit-spin 48s linear infinite;
}

.orbit-ring-inner {
  width: calc(var(--inner) * 2);
  height: calc(var(--inner) * 2);
  margin: calc(var(--inner) * -1);
  --radius: var(--inner);
}

.orbit-ring-outer {
  width: calc(var(--outer) * 2);
  height: calc(var(--outer) * 2);
  margin: calc(var(--outer) * -1);
  animation-duration: 72s;
  animation-direction: reverse;
  --radius: var(--outer);
}

.orbit-sat {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  transform: rotate(var(--angle)) translateX(var(--radius));
}

/* 两层反向旋转把图标扶正：一层抵消摆放角度，一层抵消圆环的持续转动 */
.orbit-sat-upright {
  display: block;
  transform: rotate(calc(var(--angle) * -1));
}

.orbit-sat-spin {
  display: block;
  animation: orbit-spin 48s linear infinite reverse;
}

.orbit-ring-outer .orbit-sat-spin {
  animation-duration: 72s;
  animation-direction: normal;
}

@keyframes orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

.orbit:hover .orbit-ring,
.orbit:hover .orbit-sat-spin,
.orbit.is-paused .orbit-ring,
.orbit.is-paused .orbit-sat-spin {
  animation-play-state: paused;
}

.orbit-tile {
  display: flex;
  width: 42px;
  height: 42px;
  margin: -21px;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  background-color: #fff;
  box-shadow:
    0 0 0 1px rgb(11 12 14 / 0.08),
    0 8px 20px -8px rgb(11 12 14 / 0.35);
  transition:
    transform 0.6s var(--lp-ease-spring),
    box-shadow 0.4s ease;
}

.orbit-tile:hover,
.orbit-tile.is-active {
  transform: scale(1.16);
  box-shadow:
    0 0 0 1px rgb(11 12 14 / 0.08),
    0 0 0 5px color-mix(in srgb, var(--lp-accent) 28%, transparent),
    0 10px 26px -8px var(--lp-accent);
}

.orbit-core {
  position: relative;
  display: flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: linear-gradient(145deg, var(--lp-accent), var(--lp-accent-2));
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.35),
    0 14px 34px -10px var(--lp-accent);
}

.orbit-core-pulse {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid var(--lp-accent);
  animation: orbit-pulse 3s var(--lp-ease-out) infinite;
}

@keyframes orbit-pulse {
  from {
    opacity: 0.7;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.9);
  }
}

.orbit-code {
  position: absolute;
  bottom: 30px;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding-inline: 14px;
  border: 1px solid var(--lp-line);
  border-radius: 9999px;
  background-color: var(--lp-card-solid);
  box-shadow: var(--lp-shadow);
  font-size: 12.5px;
  white-space: nowrap;
  transform: translateX(-50%);
}

.orbit-code-key {
  color: var(--lp-accent);
}

.orbit-code-punct {
  color: var(--lp-text-3);
}

.orbit-code-value {
  display: inline-block;
  color: var(--lp-text);
}

.orbit-roll-enter-active,
.orbit-roll-leave-active {
  transition:
    opacity 0.3s var(--lp-ease-out),
    transform 0.3s var(--lp-ease-out),
    filter 0.3s var(--lp-ease-out);
}

.orbit-roll-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(8px);
}

.orbit-roll-leave-to {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(-8px);
}

@media (max-width: 480px) {
  .orbit {
    --inner: 80px;
    --outer: 138px;
  }
}
</style>
