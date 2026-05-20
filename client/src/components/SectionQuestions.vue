<script setup lang="ts">
/**
 * 章节题目组件
 * 用于讲义页面的"本节题目"弹窗
 * 支持单选、多选、判断题，自动记录错题
 */
import { reactive } from 'vue'
import type { Question } from '@/api'
import { addWrongEntry } from '@/api'

const props = defineProps<{ questions: Question[]; documentId?: string; sectionId?: string }>()

// ===== 状态 =====
const ua = reactive<Record<number, string[]>>({})  // 用户答案
const sa = reactive<Record<number, boolean>>({})   // 已提交

// ===== 交互逻辑 =====

// 选择选项
function toggle(q: Question, label: string) {
  if (!ua[q.id]) ua[q.id] = []
  if (q.type === 'single' || q.type === 'judge') { ua[q.id] = [label] }
  else { const i = ua[q.id].indexOf(label); i >= 0 ? ua[q.id].splice(i, 1) : ua[q.id].push(label) }
}

// 提交答案
function submit(q: Question) {
  sa[q.id] = true
  // 答错自动加入错题本
  if (!ok(q) && props.documentId) {
    addWrongEntry({
      documentId: props.documentId,
      questionIndex: q.id,
      type: q.type,
      stem: q.stem,
      options: q.options || [],
      answer: q.answer,
      explanation: q.explanation || ''
    }).catch(() => {})
  }
}

// 判断是否正确
function ok(q: Question) {
  const user = ua[q.id] || []
  if (q.type === 'judge') return user[0] === q.answer || user[0] === q.answer.replace(/^\s+|\s+$/g, '')
  return [...user].sort().join('') === q.answer.replace(/\s/g, '')
}

// 题型标签
function typeLabel(t: Question['type']) { return t === 'single' ? '单选' : t === 'multi' ? '多选' : '判断' }

// 获取选项（判断题无选项时生成"正确/错误"）
function getOptions(q: Question): { label: string; text: string }[] {
  if (q.type === 'judge' && q.options.length === 0) {
    return [{ label: '正确', text: '✓ 正确' }, { label: '错误', text: '✗ 错误' }]
  }
  return q.options
}
</script>

<template>
  <div class="qs">
    <div v-if="questions.length === 0" class="qs-empty">本节暂无题目</div>
    <div v-for="q in questions" :key="q.id" class="q-card">
      <div class="q-head"><span class="q-type" :class="q.type">{{ typeLabel(q.type) }}</span><span class="q-stem">{{ q.stem }}</span></div>
      <div class="q-options">
        <div v-for="opt in getOptions(q)" :key="opt.label" class="q-opt" :class="{
          selected: (ua[q.id] || []).includes(opt.label),
          correct: sa[q.id] && q.answer.includes(opt.label),
          wrong: sa[q.id] && (ua[q.id] || []).includes(opt.label) && !q.answer.includes(opt.label)
        }" @click="!sa[q.id] && toggle(q, opt.label)">
          <span class="q-opt-l">{{ opt.label }}.</span><span class="q-opt-t">{{ opt.text }}</span>
        </div>
      </div>
      <div class="q-actions" v-if="!sa[q.id]"><n-button size="small" type="primary" @click="submit(q)">提交答案</n-button></div>
      <div v-if="sa[q.id]" class="q-result">
        <div :class="ok(q) ? 'q-ok' : 'q-no'">
          {{ ok(q) ? '✓ 回答正确' : '✗ 回答错误' }}<span class="q-ans">正确答案：{{ q.answer }}</span>
        </div>
        <div class="q-exp" v-if="q.explanation">{{ q.explanation }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qs { overflow-y: auto; }
.qs-empty { text-align: center; padding: 40px; color: var(--gray-600); font-size: 14px; }
.q-card {
  background: var(--card-bg); border-radius: var(--radius-sm); padding: 18px 20px; margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,.03); transition: box-shadow .2s;
}
.q-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.06); }
.q-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
.q-type { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; color: #fff; flex-shrink: 0; margin-top: 1px; }
.q-type.single { background: var(--cinnabar-red); }
.q-type.multi { background: #c68b45; }
.q-type.judge { background: #4a7fb5; }
.q-stem { font-size: 14px; line-height: 1.7; color: var(--ink-black); }
.q-options { display: flex; flex-direction: column; gap: 7px; margin-bottom: 10px; }
.q-opt {
  display: flex; align-items: center; gap: 8px; padding: 9px 14px;
  border: 1px solid var(--gray-200); border-radius: 6px;
  cursor: pointer; font-size: 14px; transition: all .15s;
}
.q-opt:hover { border-color: var(--gray-600); }
.q-opt.selected { background: var(--gray-100); color: var(--bamboo-dark); border-color: var(--bamboo-green); }
.q-opt.correct { background: #6b8e6b1a; border-color: var(--bamboo-green); color: var(--bamboo-dark); }
.q-opt.wrong { background: #c45c481a; border-color: var(--cinnabar-red); color: var(--cinnabar-dark); }
.q-opt-l { font-weight: 700; color: var(--cinnabar-red); min-width: 20px; }
.q-opt-t { color: var(--ink-light); }
.q-actions { padding-top: 4px; }
.q-result { margin-top: 12px; font-size: 14px; line-height: 1.8; }
.q-ok { color: var(--bamboo-green); font-weight: 600; }
.q-no { color: var(--cinnabar-red); font-weight: 600; }
.q-ans { color: var(--gray-600); font-weight: 400; margin-left: 8px; }
.q-exp {
  color: var(--ink-light); margin-top: 8px; padding: 12px 16px;
  background: var(--gray-100); border-radius: 6px; max-height: 160px; overflow-y: auto; font-size: 13px;
}
</style>
