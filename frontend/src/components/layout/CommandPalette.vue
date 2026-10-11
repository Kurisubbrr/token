<template>
  <Teleport to="body">
    <Transition name="cmdk">
      <div v-if="open" class="cmdk-overlay" @mousedown.self="hide">
        <div
          class="cmdk-panel text-gray-900 dark:text-white"
          role="dialog"
          aria-modal="true"
          :aria-label="t('nav.search')"
        >
          <div class="cmdk-search">
            <Icon name="search" size="md" class="shrink-0 text-gray-400 dark:text-dark-400" />
            <input
              ref="inputRef"
              v-model="query"
              class="cmdk-input"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmdk-list"
              :aria-activedescendant="flat.length ? `cmdk-item-${active}` : undefined"
              :placeholder="t('nav.searchPlaceholder')"
              autocomplete="off"
              spellcheck="false"
              @keydown="onKeydown"
            />
            <kbd class="cmdk-kbd">Esc</kbd>
          </div>

          <div id="cmdk-list" ref="listRef" class="cmdk-list" role="listbox">
            <!-- 选中项的底块：跟着上下键滑动，而不是逐项闪现 -->
            <span v-if="flat.length" class="cmdk-highlight" :style="highlightStyle" aria-hidden="true"></span>

            <template v-for="group in groups" :key="group.title">
              <div class="cmdk-group text-gray-400 dark:text-dark-500">{{ group.title }}</div>
              <button
                v-for="entry in group.entries"
                :id="`cmdk-item-${entry.index}`"
                :key="entry.item.id"
                type="button"
                role="option"
                class="cmdk-item"
                :class="{ 'is-active': entry.index === active }"
                :aria-selected="entry.index === active"
                @mousemove="active = entry.index"
                @click="run(entry.item)"
              >
                <span class="cmdk-icon">
                  <component :is="entry.item.icon" class="h-4 w-4" />
                </span>
                <span class="min-w-0 flex-1 truncate">{{ entry.item.label }}</span>
                <span v-if="entry.item.hint" class="cmdk-hint text-gray-400 dark:text-dark-500">{{ entry.item.hint }}</span>
              </button>
            </template>

            <div v-if="!flat.length" class="cmdk-empty text-gray-500 dark:text-dark-400">
              {{ t('nav.searchEmpty') }}
            </div>
          </div>

          <div class="cmdk-footer text-gray-500 dark:text-dark-400">
            <span><kbd class="cmdk-kbd">↑</kbd><kbd class="cmdk-kbd">↓</kbd>{{ t('nav.searchHintMove') }}</span>
            <span><kbd class="cmdk-kbd">↵</kbd>{{ t('nav.searchHintOpen') }}</span>
            <span><kbd class="cmdk-kbd">Esc</kbd>{{ t('nav.searchHintClose') }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useCommandPalette, type CommandItem } from './commandPalette'

const props = defineProps<{ items: CommandItem[] }>()

const { t } = useI18n()
const { open, hide, toggle } = useCommandPalette()

const query = ref('')
const active = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const highlightStyle = ref<Record<string, string>>({})

// 按空格拆成多个词，每个词都要命中（标签、说明或路径里任意一处）
const flat = computed<CommandItem[]>(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return props.items
  return props.items.filter((item) => {
    const text = `${item.label} ${item.hint ?? ''} ${item.keywords ?? ''}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
})

const groups = computed(() => {
  const byTitle = new Map<string, { title: string; entries: { item: CommandItem; index: number }[] }>()
  flat.value.forEach((item, index) => {
    let group = byTitle.get(item.group)
    if (!group) {
      group = { title: item.group, entries: [] }
      byTitle.set(item.group, group)
    }
    group.entries.push({ item, index })
  })
  return [...byTitle.values()]
})

function run(item: CommandItem) {
  hide()
  item.run()
}

function onKeydown(event: KeyboardEvent) {
  const count = flat.value.length
  if (event.key === 'Escape') {
    event.preventDefault()
    hide()
  } else if (event.key === 'ArrowDown' && count) {
    event.preventDefault()
    active.value = (active.value + 1) % count
  } else if (event.key === 'ArrowUp' && count) {
    event.preventDefault()
    active.value = (active.value - 1 + count) % count
  } else if (event.key === 'Enter' && !event.isComposing && count) {
    event.preventDefault()
    run(flat.value[active.value])
  }
}

/** 把底块移到选中项上，并保证选中项在可视范围内 */
function syncHighlight() {
  const el = listRef.value?.querySelector<HTMLElement>(`#cmdk-item-${active.value}`)
  if (!el) return
  highlightStyle.value = {
    transform: `translate3d(0, ${el.offsetTop}px, 0)`,
    height: `${el.offsetHeight}px`
  }
  el.scrollIntoView?.({ block: 'nearest' })
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    toggle()
  }
}

watch(query, () => {
  active.value = 0
})

watch([active, flat, open], () => void nextTick(syncHighlight), { flush: 'post' })

watch(open, (isOpen) => {
  if (!isOpen) return
  query.value = ''
  active.value = 0
  void nextTick(() => inputRef.value?.focus())
})

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  hide()
})
</script>

<style scoped>
.cmdk-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 15vh 16px 16px;
  background: rgb(0 0 0 / 0.32);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.dark .cmdk-overlay {
  background: rgb(0 0 0 / 0.58);
}

.cmdk-panel {
  width: min(580px, 100%);
  overflow: hidden;
  border: 1px solid var(--glass-stroke);
  border-radius: 20px;
  background: var(--glass-popover);
  box-shadow: var(--glass-shadow-lg);
}

.cmdk-search {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 14px 18px;
  border-bottom: 1px solid var(--glass-divider);
}

.cmdk-input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 15px;
  outline: none;
  caret-color: var(--app-accent);
}

.cmdk-input::placeholder {
  color: rgb(128 132 140 / 0.9);
}

.cmdk-list {
  position: relative;
  max-height: min(52vh, 420px);
  overflow-y: auto;
  padding: 6px 8px 8px;
  overscroll-behavior: contain;
}

.cmdk-group {
  padding: 10px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.cmdk-highlight {
  position: absolute;
  top: 0;
  right: 8px;
  left: 8px;
  border-radius: 12px;
  background: var(--glass-hover);
  box-shadow: inset 0 0 0 1px var(--glass-stroke);
  pointer-events: none;
  transition:
    transform 0.32s var(--ease-spring),
    height 0.2s ease;
}

.cmdk-item {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 12px;
  font-size: 14px;
  text-align: left;
}

.cmdk-icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  background: var(--glass-surface-strong);
  box-shadow: inset 0 0 0 1px var(--glass-stroke);
  transition:
    color 0.2s ease,
    transform 0.4s var(--ease-spring);
}

.cmdk-item.is-active .cmdk-icon {
  color: var(--app-accent);
  transform: scale(1.08);
}

.cmdk-hint {
  flex: none;
  font-size: 12px;
}

.cmdk-empty {
  padding: 36px 12px;
  font-size: 14px;
  text-align: center;
}

.cmdk-footer {
  display: flex;
  gap: 18px;
  padding: 10px 16px;
  border-top: 1px solid var(--glass-divider);
  font-size: 12px;
}

.cmdk-kbd {
  display: inline-flex;
  min-width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  padding: 0 5px;
  border-radius: 6px;
  background: var(--glass-surface-strong);
  box-shadow: inset 0 0 0 1px var(--glass-stroke);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
}

.cmdk-search .cmdk-kbd {
  margin-right: 0;
}

/* 出现：遮罩淡入，面板从上方轻轻落下 */
.cmdk-enter-active,
.cmdk-leave-active {
  transition: opacity 0.2s ease;
}

.cmdk-enter-active .cmdk-panel {
  transition:
    transform 0.5s var(--ease-spring),
    opacity 0.2s ease;
}

.cmdk-leave-active .cmdk-panel {
  transition:
    transform 0.16s ease,
    opacity 0.16s ease;
}

.cmdk-enter-from,
.cmdk-leave-to {
  opacity: 0;
}

.cmdk-enter-from .cmdk-panel {
  opacity: 0;
  transform: translateY(-14px) scale(0.96);
}

.cmdk-leave-to .cmdk-panel {
  opacity: 0;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .cmdk-highlight,
  .cmdk-icon,
  .cmdk-enter-active .cmdk-panel,
  .cmdk-leave-active .cmdk-panel {
    transition: none;
  }
}
</style>
