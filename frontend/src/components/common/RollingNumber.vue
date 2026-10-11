<template>
  <!-- 里程表式的数字：每一位是一条 0–9 的竖排，数值变化时滚到新的位置 -->
  <span class="rolling" :aria-label="value" role="text">
    <template v-for="cell in cells" :key="cell.key">
      <span v-if="cell.digit !== null" class="rolling-digit" aria-hidden="true">
        <span class="rolling-strip" :style="{ transform: `translateY(${-cell.digit * 10}%)` }">
          <span v-for="n in 10" :key="n">{{ n - 1 }}</span>
        </span>
      </span>
      <span v-else class="rolling-static" aria-hidden="true">{{ cell.char }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value: string }>()

// 从右往左编号作为 key：位数增减时，个位始终还是个位，不会整串错位重滚
const cells = computed(() => {
  const chars = Array.from(props.value)
  return chars.map((char, index) => ({
    key: chars.length - index,
    char,
    digit: /\d/.test(char) ? Number(char) : null
  }))
})
</script>

<style scoped>
.rolling {
  display: inline-flex;
  font-variant-numeric: tabular-nums;
}

.rolling-digit {
  display: inline-block;
  height: 1em;
  overflow: hidden;
  line-height: 1;
}

.rolling-strip {
  display: flex;
  flex-direction: column;
  transition: transform 0.9s cubic-bezier(0.32, 0.72, 0, 1);
}

.rolling-strip > span {
  display: block;
  height: 1em;
  line-height: 1;
}

.rolling-static {
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .rolling-strip {
    transition: none;
  }
}
</style>
