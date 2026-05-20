<script setup lang="ts">
/**
 * 考点清单卡片组件
 * 点击展开/收起答案
 */
import { ref } from 'vue'
import type { KeyPoint } from '@/api'

const props = defineProps<{ keyPoints: KeyPoint[] }>()

// 已展开的考点索引
const revealed = ref<Record<number, boolean>>({})

// 切换展开状态
function toggle(i: number) { revealed.value[i] = !revealed.value[i] }
</script>

<template>
  <div class="kps" v-if="keyPoints.length">
    <h2 class="kps-title">考点清单</h2>
    <div v-for="(kp, i) in keyPoints" :key="i" class="kp-card" :class="{ on: revealed[i] }" @click="toggle(i)">
      <div class="kp-q"><span class="kp-num">{{ i + 1 }}</span><span class="kp-text">{{ kp.question }}</span><span class="kp-arrow">{{ revealed[i] ? '▴' : '▾' }}</span></div>
      <div v-if="revealed[i]" class="kp-a">{{ kp.answer }}</div>
    </div>
  </div>
</template>

<style scoped>
.kps { margin-top: 40px; max-width: 880px; margin-left: auto; margin-right: auto; }
.kps-title {
  font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; margin-bottom: 18px;
  padding-bottom: 10px; border-bottom: 1px solid var(--gray-300); color: var(--ink-black);
}
.kp-card {
  background: var(--card-bg); border-radius: var(--radius-sm); padding: 16px 20px;
  margin-bottom: 8px; cursor: pointer; transition: all .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.03);
}
.kp-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.06); }
.kp-card.on { border: 1px solid var(--gray-200); background: var(--gray-100); }
.kp-q { display: flex; align-items: center; gap: 12px; font-weight: 500; color: var(--ink-black); }
.kp-text { flex: 1; font-size: .95rem; }
.kp-num {
  background: var(--cinnabar-red); color: #fff; width: 26px; height: 26px;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.kp-arrow { color: var(--gray-600); font-size: 14px; }
.kp-a {
  margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--gray-300);
  color: var(--bamboo-green); font-weight: 500; line-height: 1.8; font-size: .95rem;
  animation: kpIn .25s ease;
}
@keyframes kpIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
</style>
