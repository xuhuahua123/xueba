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
  explanation: string; wrongCount: number; consecutiveCorrect: number; mastered: boolean; imageUrl: string
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
  if (!selected.value) return
  if (selected.value.type === 'multi') {
    const arr = userAnswer.value.split('').filter(Boolean)
    const idx = arr.indexOf(label)
    if (idx >= 0) arr.splice(idx, 1)
    else arr.push(label)
    userAnswer.value = arr.sort().join('')
  } else {
    userAnswer.value = label
  }
}

// 提交答案
async function submit() {
  showAnswer.value = true
  if (!selected.value) return
  const isCorrect = selected.value.type === 'multi'
    ? userAnswer.value === selected.value.answer.replace(/\s/g, '')
    : userAnswer.value === selected.value.answer
  if (isCorrect) {
    await fetch(`${BASE}/wrong-book/${selected.value.id}/correct`, { method: 'POST' }).catch(() => {})
    await refreshList()
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
          <span class="wb-item-stem">{{ e.imageUrl ? `图片题 #${e.id}` : e.stem.substring(0, 40) }}</span>
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
        <div class="wb-q-stem">
          <img v-if="selected.imageUrl" :src="selected.imageUrl" class="wb-q-img" alt="题目图片" />
          <span v-else>{{ selected.stem }}</span>
        </div>
        <div class="wb-q-options" v-if="selected.options?.length">
          <button v-for="opt in selected.options" :key="opt.label" class="wb-opt" :class="{
            selected: userAnswer.includes(opt.label) && !showAnswer,
            correct: showAnswer && selected.answer.includes(opt.label),
            wrong: showAnswer && userAnswer.includes(opt.label) && !selected.answer.includes(opt.label)
          }" @click="toggleOption(opt.label)" :disabled="showAnswer">
            <span class="wb-opt-label">{{ opt.label }}</span><span v-if="opt.text"> {{ opt.text }}</span>
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
          <div :class="userAnswer === selected.answer || (selected.type === 'multi' && userAnswer === selected.answer.replace(/\s/g, '')) ? 'wb-ok' : 'wb-no'">
            {{ userAnswer === selected.answer || (selected.type === 'multi' && userAnswer === selected.answer.replace(/\s/g, '')) ? '✓ 正确' : '✗ 错误' }} · 答案：{{ selected.answer }}
          </div>
          <div v-if="userAnswer === selected.answer || (selected.type === 'multi' && userAnswer === selected.answer.replace(/\s/g, ''))" class="wb-hint">
            连续答对 <strong>{{ selected.consecutiveCorrect }}</strong>/2 次{{ selected.consecutiveCorrect >= 2 ? '，已掌握' : '，再做对 ' + (2 - selected.consecutiveCorrect) + ' 次即可掌握' }}
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
.wb-q-img { max-width: 100%; display: block; margin: 12px 0; border-radius: 6px; border: 1px solid var(--gray-200); }
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
.wb-hint { margin-top: 6px; font-size: .82rem; color: var(--gray-600); }
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
