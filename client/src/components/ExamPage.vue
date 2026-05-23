<script setup lang="ts">
/**
 * 章节练习页面
 * 左侧科目列表 | 中间题目区 | 右侧答题卡
 * 支持判断、单选、多选题，自动记录错题和进度
 * 移动端：下拉选择科目 + 底部答题卡
 */
import { ref, computed, onMounted } from 'vue'
import { addWrongEntry } from '@/api'
import { useResponsive } from '@/composables/useResponsive'

// ===== 响应式布局 =====
const { isMobile } = useResponsive()

// ===== 类型定义 =====
interface ExamQuestion { id: number; stem: string; options?: { label: string; text: string }[]; answer: string; explanation: string; image_url?: string }
interface ExamSection { type: string; label: string; questions: ExamQuestion[] }
interface ExamData { title: string; sections: ExamSection[] }
interface ExamListItem { id: string; title: string; sections: { type: string; label: string; count: number }[]; total: number }

// ===== 状态 =====
const subjects = ref<ExamListItem[]>([])      // 科目列表
const currentExam = ref<ExamData | null>(null) // 当前科目题目
const currentSubjectId = ref('')              // 当前科目 ID
const loading = ref(true)
const error = ref('')
const sectionIdx = ref(0)                      // 当前题型分区索引
const qIdx = ref(0)                           // 当前题目索引
const userAnswers = ref<Record<string, string>>({})      // 用户答案
const selectedOption = ref<Record<string, string>>({})  // 当前选中选项
const showResult = ref(false)                 // 是否显示结果
const submitted = ref<Set<string>>(new Set()) // 已提交题目 key 集合
const cardVisible = ref(false)                // 移动端答题卡弹窗

// 各科目答题状态缓存（切换科目时保留）
type SubjectCache = { userAnswers: Record<string, string>; submitted: Set<string> }
const subjectCache = ref<Record<string, SubjectCache>>({})

const BASE = '/api'

// ===== 统计计算 =====
const subjectStats = computed(() => {
  if (!currentExam.value) return { answered: 0, correct: 0, total: 0 }
  const total = currentExam.value.sections.reduce((s, sec) => s + sec.questions.length, 0)
  const answered = submitted.value.size
  let correct = 0
  for (const key of submitted.value) {
    const [si, qid] = key.split('_').map(Number)
    const sec = currentExam.value.sections[si]
    if (!sec) continue
    const q = sec.questions.find(qq => qq.id === qid)
    if (!q) continue
    const userAns = userAnswers.value[key] || ''
    const isCorrect = sec.type === 'multi'
      ? userAns === q.answer.replace(/\s/g, '')
      : userAns === q.answer
    if (isCorrect) correct++
  }
  return { answered, correct, total }
})

// ===== 数据加载 =====

// 加载科目列表
async function loadSubjects() {
  loading.value = true; error.value = ''
  try {
    const res = await fetch(`${BASE}/exams`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    subjects.value = data.filter((e: ExamListItem) => e.total > 0)
    if (subjects.value.length > 0) selectSubject(subjects.value[0].id)
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally { loading.value = false }
}

// 生成题目唯一键
function qKey(si: number, qid: number) { return `${si}_${qid}` }

// 选择科目
async function selectSubject(id: string) {
  // 保存当前科目答题状态
  if (currentSubjectId.value) {
    subjectCache.value[currentSubjectId.value] = {
      userAnswers: { ...userAnswers.value },
      submitted: new Set(submitted.value)
    }
  }

  currentSubjectId.value = id; loading.value = true; sectionIdx.value = 0; qIdx.value = 0
  showResult.value = false; selectedOption.value = {}

  // 尝试从内存缓存恢复
  const cached = subjectCache.value[id]
  if (cached) {
    userAnswers.value = { ...cached.userAnswers }
    submitted.value = new Set(cached.submitted)
  } else {
    userAnswers.value = {}
    submitted.value = new Set()
  }

  const res = await fetch(`${BASE}/exams/${id}`)
  currentExam.value = await res.json()

  // 从后端恢复已保存的答题进度（覆盖/补充内存缓存）
  try {
    for (let si = 0; si < currentExam.value!.sections.length; si++) {
      const pRes = await fetch(`${BASE}/exam-progress/${encodeURIComponent(id)}?sectionIdx=${si}`)
      const progress = await pRes.json()
      if (progress.answers) {
        for (const [qid, answer] of Object.entries(progress.answers)) {
          const key = qKey(si, Number(qid))
          userAnswers.value[key] = answer as string
          submitted.value.add(key)
        }
      }
    }
  } catch {}
  loading.value = false
}

// ===== 计算属性 =====
const currentSection = computed(() => currentExam.value?.sections[sectionIdx.value])
const currentQ = computed(() => currentSection.value?.questions[qIdx.value])
const totalQuestions = computed(() => currentExam.value?.sections.reduce((s, sec) => s + sec.questions.length, 0) || 0)
const currentGlobalIdx = computed(() => {
  let idx = 0
  for (let i = 0; i < sectionIdx.value; i++) idx += currentExam.value!.sections[i].questions.length
  return idx + qIdx.value + 1
})

// ===== 交互逻辑 =====

// 切换题型分区
function switchSection(idx: number) {
  showResult.value = false; selectedOption.value = {}; sectionIdx.value = idx; qIdx.value = 0
}

// 选择选项
function selectOption(label: string) {
  const key = qKey(sectionIdx.value, currentQ.value!.id)
  if (submitted.value.has(key)) return
  if (currentSection.value!.type === 'multi') {
    // 多选：支持多选项
    const arr = (selectedOption.value[key] || '').split('').filter(Boolean)
    const idx = arr.indexOf(label)
    if (idx >= 0) arr.splice(idx, 1)
    else arr.push(label)
    selectedOption.value[key] = arr.sort().join('')
  } else {
    selectedOption.value[key] = label
  }
}

// 提交答案
function submitAnswer() {
  const key = qKey(sectionIdx.value, currentQ.value!.id)
  const label = selectedOption.value[key]
  if (!label) return
  userAnswers.value[key] = label
  submitted.value.add(key)
  showResult.value = true
  const q = currentQ.value!
  const isCorrect = currentSection.value!.type === 'multi'
    ? label === q.answer.replace(/\s/g, '')
    : label === q.answer
  // 答错自动加入错题本
  if (!isCorrect) {
    addWrongEntry({
      documentId: `exam_${currentSubjectId.value}`, questionIndex: currentGlobalIdx.value,
      type: currentSection.value!.type, stem: q.stem,
      options: q.options || [], answer: q.answer, explanation: q.explanation || '',
      imageUrl: q.image_url
    })
  }
  // 保存答题进度到后端
  fetch(`${BASE}/exam-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examId: currentSubjectId.value, sectionIdx: sectionIdx.value, questionId: q.id, userAnswer: label, isCorrect })
  }).catch(() => {})
}

// 下一题
function goNext() {
  showResult.value = false; selectedOption.value = {}
  if (qIdx.value + 1 < currentSection.value!.questions.length) { qIdx.value++ }
  else if (sectionIdx.value + 1 < (currentExam.value?.sections.length || 0)) { sectionIdx.value++; qIdx.value = 0 }
}

// 上一题
function goPrev() {
  showResult.value = false; selectedOption.value = {}
  if (qIdx.value > 0) { qIdx.value-- }
  else if (sectionIdx.value > 0) { sectionIdx.value--; qIdx.value = currentExam.value!.sections[sectionIdx.value - 1].questions.length - 1 }
}

// 获取题目状态（未答/正确/错误）
function getAnswerStatus(si: number, qid: number) {
  const key = qKey(si, qid)
  if (!submitted.value.has(key)) return 'unanswered'
  const sec = currentExam.value?.sections[si]
  if (!sec) return 'unanswered'
  const q = sec.questions.find(qq => qq.id === qid)
  if (!q) return 'unanswered'
  const userAns = userAnswers.value[key] || ''
  const correctAns = sec.type === 'multi' ? q.answer.replace(/\s/g, '') : q.answer
  return userAns === correctAns ? 'correct' : 'wrong'
}

// 计算题目全局序号
function globalQNum(si: number, qid: number): number {
  if (!currentExam.value) return qid
  let offset = 0
  for (let i = 0; i < si; i++) offset += currentExam.value.sections[i].questions.length
  return offset + qid
}

// 跳转到指定题目
function jumpToQuestion(qid: number) {
  if (!currentExam.value) return
  showResult.value = false; selectedOption.value = {}
  const sec = currentExam.value.sections[sectionIdx.value]
  for (let qi = 0; qi < sec.questions.length; qi++) {
    if (sec.questions[qi].id === qid) { qIdx.value = qi; return }
  }
}

// ===== 辅助函数 =====
function typeLabel(t: string) { return t === 'single' ? '单选' : t === 'multi' ? '多选' : '判断' }
function abbr(s: string) { return s.replace(/（.*$/, '').replace(/\(.*$/, '').replace(/[一二三四五六七八九十]+[、.]/, '') }

onMounted(loadSubjects)
</script>

<template>
  <div class="exam-page">
    <!-- PC端：固定左侧科目列表 -->
    <div v-if="!isMobile" class="exam-sidebar">
      <div class="exam-sidebar-title">科目</div>
      <div v-for="s in subjects" :key="s.id" class="exam-subject" :class="{ active: currentSubjectId === s.id }" @click="selectSubject(s.id)">
        <div class="exam-subject-top">
          <span class="exam-subject-name">{{ s.title }}</span>
          <span class="exam-subject-count">{{ s.total }}题</span>
        </div>
        <div v-if="currentSubjectId === s.id" class="exam-subject-progress">
          <div class="exam-subject-bar">
            <div class="exam-subject-fill" :style="{ width: (subjectStats.answered / subjectStats.total * 100) + '%' }"></div>
          </div>
          <span class="exam-subject-stat">已答 {{ subjectStats.answered }} · 正确 {{ subjectStats.correct }}</span>
        </div>
      </div>
    </div>
    <div class="exam-main" v-if="loading">
      <div class="exam-loading">加载题库中...</div>
    </div>
    <div class="exam-main exam-empty" v-else-if="error">
      <div class="exam-error">❌ {{ error }}</div>
    </div>
    <div class="exam-main" v-else-if="currentExam && currentSection && currentQ">
      <div class="exam-header">
        <!-- 移动端：下拉选择科目 -->
        <n-select v-if="isMobile" :value="currentSubjectId" :options="subjects.map(s => ({ label: s.title, value: s.id }))" @update:value="selectSubject" style="width: 160px; margin-right: 12px;" />
        <span class="exam-header-title">{{ currentExam.title }}</span>
        <span class="exam-header-meta">{{ currentGlobalIdx }} / {{ totalQuestions }}</span>
      </div>
      <!-- Section tabs -->
      <div class="exam-section-tabs">
        <button v-for="(sec, si) in currentExam.sections" :key="si" class="exam-section-tab" :class="{ active: sectionIdx === si }" @click="switchSection(si)">
          {{ abbr(sec.label) }} <span class="exam-section-stat">{{ getAnswerStatus(si, sec.questions[0]?.id) === 'unanswered' ? '' : '●' }}</span>
        </button>
      </div>
      <div class="exam-question">
        <div class="exam-q-stem">
          <span class="exam-q-type" :class="currentSection.type">{{ typeLabel(currentSection.type) }}</span>
          <img v-if="currentQ.image_url" :src="currentQ.image_url" class="exam-q-img" alt="题目图片" />
          <span v-else>{{ currentQ.stem }}</span>
        </div>
        <div class="exam-q-options">
          <template v-if="currentSection.type === 'judge'">
            <button class="exam-opt" :class="{
              selected: selectedOption[qKey(sectionIdx,currentQ.id)] === 'A' && !submitted.has(qKey(sectionIdx,currentQ.id)),
              correct: submitted.has(qKey(sectionIdx,currentQ.id)) && currentQ.answer === 'A',
              wrong: submitted.has(qKey(sectionIdx,currentQ.id)) && userAnswers[qKey(sectionIdx,currentQ.id)] === 'A' && currentQ.answer !== 'A'
            }" @click="selectOption('A')">✓ 正确</button>
            <button class="exam-opt" :class="{
              selected: selectedOption[qKey(sectionIdx,currentQ.id)] === 'B' && !submitted.has(qKey(sectionIdx,currentQ.id)),
              correct: submitted.has(qKey(sectionIdx,currentQ.id)) && currentQ.answer === 'B',
              wrong: submitted.has(qKey(sectionIdx,currentQ.id)) && userAnswers[qKey(sectionIdx,currentQ.id)] === 'B' && currentQ.answer !== 'B'
            }" @click="selectOption('B')">✗ 错误</button>
          </template>
          <template v-else>
            <button v-for="opt in currentQ.options" :key="opt.label" class="exam-opt" :class="{
              selected: (selectedOption[qKey(sectionIdx,currentQ.id)] || '').includes(opt.label) && !submitted.has(qKey(sectionIdx,currentQ.id)),
              correct: submitted.has(qKey(sectionIdx,currentQ.id)) && (currentQ.answer || '').includes(opt.label),
              wrong: submitted.has(qKey(sectionIdx,currentQ.id)) && (userAnswers[qKey(sectionIdx,currentQ.id)] || '').includes(opt.label) && !(currentQ.answer || '').includes(opt.label)
            }" @click="selectOption(opt.label)">
              <span class="exam-opt-label">{{ opt.label }}</span><span v-if="opt.text">{{ opt.text }}</span>
            </button>
          </template>
        </div>
        <div class="exam-q-actions" v-if="selectedOption[qKey(sectionIdx,currentQ.id)] && !submitted.has(qKey(sectionIdx,currentQ.id))">
          <n-button type="primary" size="medium" @click="submitAnswer">提交答案</n-button>
        </div>
        <div v-if="submitted.has(qKey(sectionIdx,currentQ.id))" class="exam-result">
          <div :class="(currentSection.type === 'multi' ? userAnswers[qKey(sectionIdx,currentQ.id)] === currentQ.answer.replace(/\s/g, '') : userAnswers[qKey(sectionIdx,currentQ.id)] === currentQ.answer) ? 'exam-result-ok' : 'exam-result-no'">
            {{ (currentSection.type === 'multi' ? userAnswers[qKey(sectionIdx,currentQ.id)] === currentQ.answer.replace(/\s/g, '') : userAnswers[qKey(sectionIdx,currentQ.id)] === currentQ.answer) ? '✓ 回答正确' : '✗ 回答错误' }} · 答案：{{ currentQ.answer }}
          </div>
          <div class="exam-result-exp" v-if="currentQ.explanation">{{ currentQ.explanation }}</div>
        </div>
      </div>
      <div class="exam-nav">
        <n-button size="small" @click="goPrev" :disabled="sectionIdx === 0 && qIdx === 0">◀ 上一题</n-button>
        <n-button size="small" type="primary" @click="goNext">下一题 ▶</n-button>
      </div>
    </div>
    <!-- PC端：右侧答题卡面板 -->
    <div v-if="!isMobile && currentSection" class="exam-card-panel">
      <div class="exam-card-header">
        <span class="exam-card-type-dot" :class="currentSection.type"></span>
        答题卡 · {{ typeLabel(currentSection.type) }}
      </div>
      <div class="exam-card-grid">
        <span v-for="q in currentSection.questions" :key="q.id" class="exam-card-dot" :class="getAnswerStatus(sectionIdx, q.id)" @click="jumpToQuestion(q.id)">{{ globalQNum(sectionIdx, q.id) }}</span>
      </div>
      <div class="exam-card-legend">
        <span class="exam-card-leg"><span class="exam-card-dot unanswered"></span> 未答</span>
        <span class="exam-card-leg"><span class="exam-card-dot correct"></span> 正确</span>
        <span class="exam-card-leg"><span class="exam-card-dot wrong"></span> 错误</span>
      </div>
    </div>
    <!-- 移动端：浮动按钮 + 弹窗答题卡 -->
    <button v-if="isMobile && currentSection" class="exam-card-btn" @click="cardVisible = true">
      <span class="exam-card-btn-dot" :class="getAnswerStatus(sectionIdx, currentQ?.id ?? 0)"></span>
      {{ currentGlobalIdx }}/{{ totalQuestions }}
    </button>
    <n-drawer v-if="isMobile" v-model:show="cardVisible" placement="bottom" :height="360">
      <div class="exam-card-drawer">
        <div class="exam-card-drawer-header">
          <span>答题卡 · {{ typeLabel(currentSection?.type || 'single') }}</span>
          <button class="exam-card-drawer-close" @click="cardVisible = false">✕</button>
        </div>
        <div class="exam-card-drawer-grid" v-if="currentSection">
          <span v-for="q in currentSection.questions" :key="q.id" class="exam-card-dot" :class="getAnswerStatus(sectionIdx, q.id)" @click="jumpToQuestion(q.id); cardVisible = false">{{ globalQNum(sectionIdx, q.id) }}</span>
        </div>
        <div class="exam-card-drawer-legend">
          <span><span class="exam-card-dot unanswered"></span> 未答</span>
          <span><span class="exam-card-dot correct"></span> 正确</span>
          <span><span class="exam-card-dot wrong"></span> 错误</span>
        </div>
      </div>
    </n-drawer>
  </div>
</template>

<style scoped>
.exam-page { display: flex; height: 100%; }
.exam-sidebar {
  width: 240px; min-width: 240px; background: var(--card-bg);
  border-right: 1px solid var(--gray-200); overflow-y: auto; padding: 16px 0;
}
.exam-sidebar-title { padding: 0 16px 14px; font-family: var(--font-display); font-weight: 700; font-size: 1rem; color: var(--ink-black); }
.exam-subject { padding: 12px 16px; cursor: pointer; transition: all .12s; border-left: 3px solid transparent; margin-bottom: 1px; }
.exam-subject:hover { background: var(--paper-dark); }
.exam-subject.active { background: var(--paper-dark); border-left-color: var(--cinnabar-red); }
.exam-subject-top { display: flex; align-items: center; justify-content: space-between; }
.exam-subject-name { font-size: .9rem; font-weight: 500; }
.exam-subject.active .exam-subject-name { color: var(--cinnabar-red); font-weight: 600; }
.exam-subject-count { font-size: .78rem; color: var(--gray-600); }
.exam-subject-progress { margin-top: 8px; }
.exam-subject-bar { height: 4px; background: var(--gray-200); border-radius: 2px; overflow: hidden; }
.exam-subject-fill { height: 100%; background: var(--cinnabar-red); border-radius: 2px; transition: width .3s; }
.exam-subject-stat { font-size: .73rem; color: var(--gray-600); margin-top: 4px; display: block; }

.exam-main { flex: 1; display: flex; flex-direction: column; padding: 24px 36px; overflow-y: auto; }
.exam-loading { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--gray-600); font-size: 1.1rem; }
.exam-error { color: var(--cinnabar-red); text-align: center; padding: 40px; }
.exam-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.exam-header-title { font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; color: var(--ink-black); }
.exam-header-meta { font-size: .9rem; color: var(--gray-600); font-weight: 500; }

/* Section tabs */
.exam-section-tabs { display: flex; gap: 6px; margin-bottom: 20px; flex-shrink: 0; }
.exam-section-tab {
  border: 1px solid var(--gray-300); background: var(--card-bg); padding: 6px 14px;
  border-radius: 20px; font-size: .82rem; cursor: pointer; color: var(--gray-700);
  font-family: inherit; transition: all .15s; display: flex; align-items: center; gap: 4px;
}
.exam-section-tab:hover { border-color: var(--cinnabar-red); color: var(--cinnabar-red); }
.exam-section-tab.active { background: var(--cinnabar-red); color: #fff; border-color: var(--cinnabar-red); font-weight: 600; }
.exam-section-stat { font-size: 10px; color: var(--bamboo-green); }

.exam-question { background: var(--card-bg); border-radius: var(--radius); padding: 28px 32px; box-shadow: 0 1px 4px rgba(0,0,0,.04); margin-bottom: 16px; flex: 1 1 0; min-height: 0; overflow-y: auto; }
.exam-q-stem { font-size: 1.05rem; line-height: 1.8; margin-bottom: 22px; color: var(--ink-black); }
.exam-q-img { max-width: 100%; display: block; margin: 12px 0; border-radius: 6px; border: 1px solid var(--gray-200); }
.exam-q-type { display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: .78rem; font-weight: 600; color: #fff; margin-right: 10px; }
.exam-q-type.judge { background: var(--cinnabar-red); }
.exam-q-type.single { background: #4a7fb5; }
.exam-q-type.multi { background: #c68b45; }
.exam-q-options { display: flex; flex-direction: column; gap: 10px; }
.exam-opt {
  display: flex; align-items: center; gap: 8px; padding: 14px 18px;
  border: 1px solid var(--gray-200); border-radius: var(--radius-sm);
  cursor: pointer; font-size: .95rem; transition: all .18s;
  background: var(--card-bg); color: var(--ink-black); font-family: inherit; text-align: left;
  max-width: 600px;
}
.exam-opt:hover { border-color: var(--cinnabar-red); transform: translateX(2px); }
.exam-opt.selected { border-color: var(--bamboo-green); background: var(--gray-100); font-weight: 600; }
.exam-opt.correct { border-color: var(--bamboo-green); background: #6b8e6b1a; color: var(--bamboo-dark); }
.exam-opt.wrong { border-color: var(--cinnabar-red); background: #c45c481a; color: var(--cinnabar-dark); }
.exam-opt-label { font-weight: 700; color: var(--cinnabar-red); min-width: 22px; font-size: .9rem; }
.exam-result { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--gray-200); }
.exam-result-ok { color: var(--bamboo-green); font-weight: 600; }
.exam-result-no { color: var(--cinnabar-red); font-weight: 600; }
.exam-result-exp { color: var(--ink-light); margin-top: 10px; padding: 12px 16px; background: var(--gray-100); border-radius: 6px; font-size: .9rem; line-height: 1.7; max-height: 220px; overflow-y: auto; }
.exam-q-actions { margin-top: 18px; display: flex; justify-content: center; }

.exam-nav { display: flex; align-items: center; gap: 12px; flex-shrink: 0; justify-content: space-between; }

/* Right answer card panel */
.exam-card-panel {
  width: 200px; min-width: 200px; border-left: 1px solid var(--gray-200);
  background: var(--card-bg); display: flex; flex-direction: column; overflow: hidden;
}
.exam-card-header {
  padding: 16px 14px 10px; font-weight: 700; font-size: .85rem;
  color: var(--ink-black); border-bottom: 1px solid var(--gray-200); flex-shrink: 0;
  display: flex; align-items: center; gap: 6px;
}
.exam-card-type-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.exam-card-type-dot.judge { background: var(--cinnabar-red); }
.exam-card-type-dot.single { background: #4a7fb5; }
.exam-card-type-dot.multi { background: #c68b45; }
.exam-card-grid {
  flex: 1; overflow-y: auto; padding: 10px 12px;
  display: flex; flex-wrap: wrap; align-content: flex-start; gap: 5px;
}
.exam-card-legend {
  padding: 10px 12px; border-top: 1px solid var(--gray-200);
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
.exam-card-leg { display: flex; align-items: center; gap: 6px; font-size: .73rem; color: var(--gray-600); }
.exam-card-leg .exam-card-dot { cursor: default; }
.exam-card-leg .exam-card-dot:hover { transform: none; border-color: var(--gray-300); }
.exam-card-dot {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 5px; font-size: 11px;
  cursor: pointer; border: 1px solid var(--gray-300); background: var(--card-bg);
  color: var(--gray-600); transition: all .12s; flex-shrink: 0;
}
.exam-card-dot:hover { border-color: var(--cinnabar-red); transform: scale(1.1); }
.exam-card-dot.correct { background: var(--bamboo-green); color: #fff; border-color: var(--bamboo-green); }
.exam-card-dot.wrong { background: var(--cinnabar-red); color: #fff; border-color: var(--cinnabar-red); }
.exam-card-dot.unanswered { background: var(--gray-100); }

/* 移动端：浮动答题卡按钮 */
.exam-card-btn {
  position: fixed; bottom: 80px; right: 20px;
  display: flex; align-items: center; gap: 8px;
  padding: 12px 20px; border: none; border-radius: 24px;
  background: var(--cinnabar-red); color: #fff;
  font-size: .9rem; font-weight: 600; font-family: inherit;
  box-shadow: 0 4px 12px rgba(0,0,0,.2);
  cursor: pointer; z-index: 100;
}
.exam-card-btn-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--gray-200);
}
.exam-card-btn-dot.correct { background: var(--bamboo-green); }
.exam-card-btn-dot.wrong { background: #fff; }

/* 移动端：答题卡弹窗 */
.exam-card-drawer {
  height: 100%; display: flex; flex-direction: column;
  background: var(--card-bg);
}
.exam-card-drawer-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--gray-200);
  font-weight: 700; font-size: 1rem; color: var(--ink-black);
}
.exam-card-drawer-close {
  border: none; background: none; font-size: 1.2rem;
  color: var(--gray-600); cursor: pointer; padding: 4px 8px;
}
.exam-card-drawer-grid {
  flex: 1; overflow-y: auto; padding: 16px;
  display: flex; flex-wrap: wrap; gap: 8px;
  align-content: flex-start;
}
.exam-card-drawer-grid .exam-card-dot {
  width: calc((100% - 32px) / 5); min-width: 40px; height: 36px;
  font-size: 13px;
}
.exam-card-drawer-legend {
  display: flex; gap: 16px; padding: 12px 20px;
  border-top: 1px solid var(--gray-200);
  font-size: .8rem; color: var(--gray-600);
}
.exam-card-drawer-legend .exam-card-dot {
  width: 16px; height: 16px; font-size: 0; margin-right: 4px;
  cursor: default;
}

/* ===== 移动端响应式 ===== */
@media (max-width: 768px) {
  .exam-main { padding: 16px 20px 80px; }
  .exam-header { flex-wrap: wrap; gap: 8px; }
  .exam-header-title { font-size: 1rem; }
  .exam-section-tabs { overflow-x: auto; padding-bottom: 4px; }
  .exam-question { padding: 20px 24px; }
  .exam-q-stem { font-size: 1rem; }
  .exam-opt { padding: 16px 20px; max-width: 100%; }
  .exam-nav { padding-bottom: 10px; }
}
</style>
