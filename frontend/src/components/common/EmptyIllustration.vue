<template>
  <!-- 空状态的小插画：两张叠放的卡片浮在虚线圆环上，前面那张放图标 -->
  <div class="empty-art" aria-hidden="true">
    <span class="empty-art-ring"></span>
    <span class="empty-art-ring empty-art-ring-inner"></span>
    <span class="empty-art-card empty-art-card-back"></span>
    <span class="empty-art-card empty-art-card-front text-gray-500 dark:text-dark-300">
      <slot>
        <Icon :name="icon" size="lg" />
      </slot>
    </span>
    <span class="empty-art-dot empty-art-dot-a"></span>
    <span class="empty-art-dot empty-art-dot-b"></span>
  </div>
</template>

<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue'
import type { IconName } from '@/components/icons/iconSet'

withDefaults(defineProps<{ icon?: IconName }>(), { icon: 'inbox' })
</script>

<style scoped>
.empty-art {
  position: relative;
  width: 132px;
  height: 104px;
  margin: 0 auto 1.25rem;
}

.empty-art-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 128px;
  height: 128px;
  margin: -64px 0 0 -64px;
  border: 1px dashed var(--glass-stroke);
  border-radius: 50%;
  -webkit-mask-image: linear-gradient(to bottom, #000 35%, transparent 92%);
  mask-image: linear-gradient(to bottom, #000 35%, transparent 92%);
  animation: empty-art-spin 60s linear infinite;
}

.empty-art-ring-inner {
  width: 84px;
  height: 84px;
  margin: -42px 0 0 -42px;
  animation-direction: reverse;
  animation-duration: 45s;
}

.empty-art-card {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 56px;
  height: 56px;
  margin: -28px 0 0 -28px;
  place-items: center;
  border: 1px solid var(--glass-stroke);
  border-radius: 16px;
  background: var(--glass-popover);
  box-shadow: var(--glass-shadow-sm);
}

.empty-art-card-back {
  opacity: 0.6;
  transform: translate(-14px, -6px) rotate(-12deg);
}

.empty-art-card-front {
  transform: translate(6px, 2px) rotate(5deg);
  animation: empty-art-float 6s ease-in-out infinite;
}

.empty-art-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-accent);
  opacity: 0.55;
  animation: empty-art-blink 3.6s ease-in-out infinite;
}

.empty-art-dot-a {
  top: 14px;
  right: 22px;
}

.empty-art-dot-b {
  bottom: 22px;
  left: 16px;
  width: 4px;
  height: 4px;
  animation-delay: 1.4s;
}

@keyframes empty-art-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes empty-art-float {
  50% {
    transform: translate(6px, -3px) rotate(3deg);
  }
}

@keyframes empty-art-blink {
  50% {
    opacity: 0.15;
    transform: scale(0.7);
  }
}

@media (prefers-reduced-motion: reduce) {
  .empty-art-ring,
  .empty-art-card-front,
  .empty-art-dot {
    animation: none;
  }
}
</style>
