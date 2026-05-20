<script setup lang="ts">
/**
 * 题目卡片组件
 * 用于章节练习页面，支持单选、多选、判断题
 */
import { ref, reactive } from 'vue'
import type { Question } from '@/api'

const props = defineProps<{
  questions: Question[]
}>()

// ===== 状态 =====
const userAnswers = reactive<Record<number, string[]>>({})  // 用户答案
const showAnswer = ref<Record<number, boolean>>({})         // 是否已提交

// ===== 交互逻辑 =====

// 选择选项
function toggleOption(q: Question, label: string) {
  if (!userAnswers[q.id]) userAnswers[q.id] = []
  if (q.type === 'single') {
    userAnswers[q.id] = [label]
  } else {
    const idx = userAnswers[q.id].indexOf(label)
    if (idx >= 0) userAnswers[q.id].splice(idx, 1)
    else userAnswers[q.id].push(label)
  }
}

// 提交答案
function submitAnswer(q: Question) {
  showAnswer[q.id] = true
}

// 判断是否正确
function isCorrect(q: Question): boolean {
  const user = userAnswers[q.id] || []
  const answer = q.answer.replace(/\s/g, '')
  const userSorted = [...user].sort().join('')
  return userSorted === answer
}

// 题型标签
function getTypeLabel(type: Question['type']) {
  return type === 'single' ? '单选题' : type === 'multi' ? '多选题' : '判断题'
}
</script>

<template>
  <div class="questions-section" v-if="questions.length">
    <h2 class="section-title">真题再现</h2>
    <div
      v-for="q in questions"
      :key="q.id"
      class="question-card"
      :class="{ correct: showAnswer[q.id] && isCorrect(q), wrong: showAnswer[q.id] && !isCorrect(q) }"
    >
      <div class="q-header">
        <span class="q-type">{{ getTypeLabel(q.type) }}</span>
        <span class="q-stem">{{ q.stem }}</span>
      </div>
      <div class="q-options">
        <div
          v-for="opt in q.options"
          :key="opt.label"
          class="q-option"
          :class="{
            selected: (userAnswers[q.id] || []).includes(opt.label),
            'correct-answer': showAnswer[q.id] && q.answer.includes(opt.label),
            'wrong-answer': showAnswer[q.id] && (userAnswers[q.id] || []).includes(opt.label) && !q.answer.includes(opt.label)
          }"
          @click="!showAnswer[q.id] && toggleOption(q, opt.label)"
        >
          <span class="opt-label">{{ opt.label }}</span>
          <span class="opt-text">{{ opt.text }}</span>
        </div>
      </div>
      <div class="q-actions">
        <n-button
          type="primary"
          size="small"
          :disabled="showAnswer[q.id]"
          @click="submitAnswer(q)"
        >
          提交答案
        </n-button>
      </div>
      <div v-if="showAnswer[q.id]" class="q-explanation">
        <div class="q-answer-row">
          <span :class="isCorrect(q) ? 'correct-text' : 'wrong-text'">
            {{ isCorrect(q) ? '✓ 回答正确' : '✗ 回答错误' }}
          </span>
          <span class="right-answer">答案：{{ q.answer }}</span>
        </div>
        <div class="q-explain" v-if="q.explanation">
          <strong>解析：</strong>{{ q.explanation }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.questions-section {
  margin-top: 32px;
}
.section-title {
  font-size: 20px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #18a058;
}
.question-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}
.question-card.correct {
  border-color: #18a058;
  background: #f0faf3;
}
.question-card.wrong {
  border-color: #d03050;
  background: #fef0f0;
}
.q-header {
  margin-bottom: 12px;
}
.q-type {
  display: inline-block;
  background: #18a058;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-right: 8px;
}
.q-stem {
  font-weight: 500;
  line-height: 1.6;
}
.q-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.q-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 180px;
}
.q-option:hover {
  border-color: #18a058;
  background: #f0faf3;
}
.q-option.selected {
  border-color: #18a058;
  background: #e8f8ef;
}
.q-option.correct-answer {
  border-color: #18a058;
  background: #d0f0e0;
}
.q-option.wrong-answer {
  border-color: #d03050;
  background: #fde0e0;
}
.opt-label {
  font-weight: 600;
  min-width: 20px;
  color: #666;
}
.q-actions {
  margin-top: 12px;
}
.q-explanation {
  margin-top: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.7;
}
.q-answer-row {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}
.correct-text {
  color: #18a058;
  font-weight: 600;
}
.wrong-text {
  color: #d03050;
  font-weight: 600;
}
.right-answer {
  color: #666;
}
</style>
