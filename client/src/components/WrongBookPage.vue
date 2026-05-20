<script setup lang="ts">
/**
 * 错题本页面
 * 左侧错题列表（支持筛选） | 右侧题目详情
 * 答对后自动标记，连续答对 2 次标记为已掌握
 * 移动端：列表/详情切换模式
 */
import { ref, onMounted, computed } from 'vue'
import { getWrongBook } from '@/api'
import { useResponsive } from '@/composables/useResponsive'

const BASE = '/api'

// ===== 响应式布局 =====
const { isMobile } = useResponsive()

// ===== 类型定义 =====
interface WrongEntry {
  id: number; documentId: string; questionIndex: number; type: string
  stem: string; options: { label: string; text: string }[]; answer: string
  explanation: string; wrongCount: number; mastered: boolean
}

// ===== 状态 =====
const entries = ref<WrongEntry[]>([])  // 错题列表
const filter = ref('active')           // 筛选：active/all/mastered
const selectedId = ref<number | null>(null)  // 选中题目
const showAnswer = ref(false)          // 是否显示答案
const userAnswer = ref('')             // 用户答案
const loading = ref(true)
const error = ref('')

// ===== 数据加载 =====
onMounted(async () => {
  try {
    entries.value = await getWrongBook()
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
})

// ===== 计算属性 =====

// 筛选后的错题列表
const filtered = computed(() => {
  if (filter.value === 'mastered') return entries.value.filter(e => e.mastered)
  if (filter.value === 'active') return entries.value.filter(e => !e.mastered)
  return entries.value
})

// 当前选中的错题
const selected = computed(() => entries.value.find(e => e.id === selectedId.value))

// ===== 交互逻辑 =====

// 选择错题
function selectEntry(id: number) {
  selectedId.value = id
  showAnswer.value = false
  userAnswer.value = ''
}

// 选择选项
function toggleOption(label: string) {
  userAnswer.value = label
}

// 提交答案
function submit() {
  showAnswer.value = true
  // 答对后通知后端（用于掌握度追踪）
  if (selected.value && userAnswer.value === selected.value.answer) {
    fetch(`${BASE}/wrong-book/${selected.value.id}/correct`, { method: 'POST' }).catch(() => {})
  }
}

// 刷新列表
async function refreshList() {
  entries.value = await getWrongBook()
}

// ===== 辅助函数 =====

// 获取科目名称
function getSubjectName(docId: string): string {
  // 章节练习的题目（exam_ 前缀）
  if (docId.startsWith('exam_')) return docId.replace('exam_', '').replace(/\.json$/, '')
  // 讲义中的题目
  return docId.replace(/\.md$/, '').replace(/^（公共基础知识）/, '').replace(/^（行政职业能力测验）/, '')
}

// 题型标签
function typeLabel(t: string) {
  return t === 'single' ? '单选' : t === 'multi' ? '多选' : '判断'
}
</script>

<template>
  <div class="wb-page">
    <!-- 列表区域：移动端显示详情时隐藏 -->
    <div class="wb-sidebar" :class="{ 'wb-sidebar-hidden-mobile': isMobile && selectedId }">
      <div class="wb-sidebar-title">错题本</div>
      <div class="wb-filter">
        <button :class="{ active: filter === 'active' }" @click="filter = 'active'">待掌握 ({{ entries.filter(e => !e.mastered).length }})</button>
        <button :class="{ active: filter === 'all' }" @click="filter = 'all'">全部 ({{ entries.length }})</button>
        <button :class="{ active: filter === 'mastered' }" @click="filter = 'mastered'">已掌握 ({{ entries.filter(e => e.mastered).length }})</button>
      </div>
      <div class="wb-list" v-if="loading">
        <div class="wb-empty">加载中...</div>
      </div>
      <div class="wb-list" v-else-if="error">
        <div class="wb-empty wb-error">❌ {{ error }}</div>
      </div>
      <div class="wb-list" v-else-if="filtered.length">
        <div v-for="e in filtered" :key="e.id" class="wb-item" :class="{ active: selectedId === e.id, mastered: e.mastered }" @click="selectEntry(e.id)">
          <span class="wb-item-type" :class="e.type">{{ typeLabel(e.type) }}</span>
          <span class="wb-item-stem">{{ e.stem.substring(0, 40) }}...</span>
          <span class="wb-item-count" v-if="e.wrongCount > 1">×{{ e.wrongCount }}</span>
        </div>
      </div>
      <div class="wb-empty" v-else>暂无错题</div>
    </div>
    <!-- 详情区域：移动端选中时才显示 -->
    <div class="wb-main" v-if="selected" :class="{ 'wb-main-mobile': isMobile }">
      <!-- 移动端返回按钮 -->
      <button v-if="isMobile" class="wb-back-btn" @click="selectedId = null">← 返回列表</button>
      <div class="wb-q-card">
        <div class="wb-q-head">
          <span class="wb-q-type" :class="selected.type">{{ typeLabel(selected.type) }}</span>
          <span class="wb-q-source">{{ getSubjectName(selected.documentId) }}</span>
          <span class="wb-q-count" v-if="selected.wrongCount > 1">错过 {{ selected.wrongCount }} 次</span>
        </div>
        <div class="wb-q-stem">{{ selected.stem }}</div>
        <div class="wb-q-options" v-if="selected.options?.length">
          <button v-for="opt in selected.options" :key="opt.label" class="wb-opt" :class="{
            selected: userAnswer === opt.label && !showAnswer,
            correct: showAnswer && selected.answer.includes(opt.label),
            wrong: showAnswer && userAnswer === opt.label && !selected.answer.includes(opt.label)
          }" @click="toggleOption(opt.label)" :disabled="showAnswer">
            <span class="wb-opt-label">{{ opt.label }}</span> {{ opt.text }}
          </button>
        </div>
        <div class="wb-q-options" v-else>
          <button class="wb-opt" :class="{
            selected: userAnswer === 'A' && !showAnswer,
            correct: showAnswer && selected.answer === 'A',
            wrong: showAnswer && userAnswer === 'A' && selected.answer !== 'A'
          }" @click="toggleOption('A')" :disabled="showAnswer">✓ 正确</button>
          <button class="wb-opt" :class="{
            selected: userAnswer === 'B' && !showAnswer,
            correct: showAnswer && selected.answer === 'B',
            wrong: showAnswer && userAnswer === 'B' && selected.answer !== 'B'
          }" @click="toggleOption('B')" :disabled="showAnswer">✗ 错误</button>
        </div>
        <div class="wb-q-actions" v-if="!showAnswer && userAnswer">
          <n-button size="small" type="primary" @click="submit">提交</n-button>
        </div>
        <div v-if="showAnswer" class="wb-q-result">
          <div :class="userAnswer === selected.answer ? 'wb-ok' : 'wb-no'">
            {{ userAnswer === selected.answer ? '✓ 正确' : '✗ 错误' }} · 答案：{{ selected.answer }}
          </div>
          <div class="wb-exp" v-if="selected.explanation">{{ selected.explanation }}</div>
        </div>
      </div>
    </div>
    <div class="wb-main wb-empty" v-else>选择左侧错题查看</div>
  </div>
</template>

<style scoped>
.wb-page { display: flex; height: 100%; }
.wb-sidebar { width: 280px; min-width: 280px; background: var(--card-bg); border-right: 1px solid var(--gray-200); overflow-y: auto; display: flex; flex-direction: column; }
.wb-sidebar-title { padding: 18px 18px 12px; font-weight: 700; font-size: 1rem; color: var(--ink-black); }
.wb-filter { display: flex; gap: 4px; padding: 0 14px 12px; }
.wb-filter button { border: 1px solid var(--gray-200); background: var(--card-bg); padding: 4px 10px; border-radius: 6px; font-size: .78rem; cursor: pointer; color: var(--gray-700); font-family: inherit; }
.wb-filter button.active { background: var(--cinnabar-red); color: #fff; border-color: var(--cinnabar-red); }
.wb-list { flex: 1; overflow-y: auto; padding: 4px 10px; }
.wb-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 6px; cursor: pointer; margin-bottom: 2px; transition: all .12s; }
.wb-item:hover { background: var(--paper-dark); }
.wb-item.active { background: var(--paper-dark); }
.wb-item.mastered { opacity: .6; }
.wb-item-type { font-size: 11px; padding: 1px 6px; border-radius: 8px; color: #fff; font-weight: 600; flex-shrink: 0; }
.wb-item-type.single { background: var(--cinnabar-red); }
.wb-item-type.multi { background: #c68b45; }
.wb-item-type.judge { background: var(--cinnabar-red); }
.wb-item-stem { flex: 1; font-size: .85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-black); }
.wb-item-count { font-size: .75rem; color: var(--cinnabar-red); font-weight: 600; }
.wb-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--gray-600); font-size: .95rem; padding: 40px; }
.wb-main { flex: 1; overflow-y: auto; padding: 28px 36px; }
.wb-q-card { background: var(--card-bg); border-radius: var(--radius); padding: 28px 32px; box-shadow: 0 1px 4px rgba(0,0,0,.04); }
.wb-q-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.wb-q-type { font-size: 11px; padding: 2px 10px; border-radius: 12px; color: #fff; font-weight: 600; }
.wb-q-type.single { background: var(--cinnabar-red); }
.wb-q-type.multi { background: #c68b45; }
.wb-q-type.judge { background: var(--cinnabar-red); }
.wb-q-source { font-size: .85rem; color: var(--gray-600); }
.wb-q-count { font-size: .8rem; color: var(--cinnabar-red); }
.wb-q-stem { font-size: 1.05rem; line-height: 1.8; margin-bottom: 18px; color: var(--ink-black); }
.wb-q-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.wb-opt { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); cursor: pointer; font-size: .95rem; background: var(--card-bg); color: var(--ink-black); font-family: inherit; text-align: left; transition: all .15s; }
.wb-opt:hover:not(:disabled) { border-color: var(--gray-600); }
.wb-opt.selected { border-color: var(--bamboo-green); background: var(--gray-100); }
.wb-opt.correct { border-color: var(--bamboo-green); background: #6b8e6b1a; }
.wb-opt.wrong { border-color: var(--cinnabar-red); background: #c45c481a; }
.wb-opt:disabled { opacity: .7; cursor: default; }
.wb-opt-label { font-weight: 700; color: var(--cinnabar-red); }
.wb-q-actions { margin-top: 12px; }
.wb-q-result { margin-top: 14px; }
.wb-ok { color: var(--bamboo-green); font-weight: 600; }
.wb-no { color: var(--cinnabar-red); font-weight: 600; }
.wb-exp { color: var(--ink-light); margin-top: 8px; padding: 12px; background: var(--paper-dark); border-radius: 6px; font-size: .9rem; line-height: 1.7; max-height: 200px; overflow-y: auto; }

/* 移动端返回按钮 */
.wb-back-btn {
  border: none; background: var(--gray-100); padding: 10px 16px;
  border-radius: 6px; font-size: .9rem; cursor: pointer;
  color: var(--ink-black); margin-bottom: 16px; font-family: inherit;
}

/* ===== 移动端响应式 ===== */
@media (max-width: 768px) {
  .wb-sidebar { width: 100%; min-width: 100%; }
  .wb-sidebar-hidden-mobile { display: none; }
  .wb-main { padding: 16px 20px; }
  .wb-main-mobile { width: 100%; }
  .wb-q-card { padding: 20px 24px; }
  .wb-q-stem { font-size: 1rem; }
  .wb-opt { padding: 14px 18px; }
}
</style>
