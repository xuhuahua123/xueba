<script setup lang="ts">
/**
 * 主应用组件
 * 三栏布局：左侧目录 | 中间内容 | 右侧章节导航
 * 顶栏 Tab：讲义学习 | 章节练习 | 错题本
 * 移动端：单栏 + 抽屉导航
 */
import { ref, watch, onMounted, computed } from 'vue'
import type { TreeNode, QuestionGroup } from '@/api'
import { fetchDocumentTree, fetchDocumentContent, fetchDocumentParsed, fetchProgress, updateProgress } from '@/api'
import type { Question, KeyPoint } from '@/api'
import Sidebar from './components/Sidebar.vue'
import MarkdownView from './components/MarkdownView.vue'
import SectionQuestions from './components/SectionQuestions.vue'
import KeyPointCard from './components/KeyPointCard.vue'
import AiModal from './components/AiModal.vue'
import ExamPage from './components/ExamPage.vue'
import WrongBookPage from './components/WrongBookPage.vue'
import { slugify } from './utils/slugify'
import { useResponsive } from './composables/useResponsive'

// ===== 响应式布局 =====
const { isMobile } = useResponsive()

// ===== 状态定义 =====

// 当前 Tab
const activeTab = ref<'lecture' | 'exam' | 'wrong'>('lecture')

// 移动端抽屉状态
const sidebarVisible = ref(false)
const tocVisible = ref(false)

// 文档树和选中项
const tree = ref<TreeNode[]>([])
const selectedKey = ref<string>('')

// 当前文档内容
const markdownContent = ref<string>('')
const questions = ref<Question[]>([])
const keyPoints = ref<KeyPoint[]>([])
const questionGroups = ref<QuestionGroup[]>([])
const loading = ref(false)

// 学习进度
const progressMap = ref<Record<string, string>>({})

// 当前章节（用于 AI 导师）
const currentSectionId = ref<string>('')
const aiVisible = ref(false)
const quizVisible = ref(false)

// ===== 主题配置（朱砂红 + 宣纸色） =====
const themeOverrides = {
  common: { primaryColor: '#b84c3c', primaryColorHover: '#9a3e30', primaryColorPressed: '#7d3227', borderRadius: '8px', borderRadiusSmall: '6px' },
  Button: { borderRadiusMedium: '8px', borderRadiusSmall: '6px' }, Tag: { borderRadius: '12px' }, Modal: { borderRadius: '14px' },
}

// ===== 计算属性 =====

// 当前文档标题
const currentTitle = computed(() => {
  if (!selectedKey.value) return ''
  for (const cat of tree.value) { const child = cat.children?.find(c => c.key === selectedKey.value); if (child) return child.label }
  return selectedKey.value.replace(/\.md$/, '')
})

// 当前文档状态
const currentStatus = computed(() => progressMap.value[selectedKey.value] || 'not_started')

// 当前章节题目组
const currentGroup = computed(() => currentSectionId.value
  ? questionGroups.value.find(g => g.sectionId === currentSectionId.value) || null : questionGroups.value[0] || null)

// 状态标签和颜色
const statusLabels: Record<string, string> = { not_started: '未开始', learning: '学习中', completed: '已完成' }
const statusColors: Record<string, string> = { not_started: 'default', learning: 'info', completed: 'success' } as const
const nextStatus: Record<string, string> = { not_started: 'learning', learning: 'completed', completed: 'not_started' }

// ===== 目录树（TOC） =====

interface TocNode { level: number; text: string; id: string; children: TocNode[] }

// 从 Markdown 内容提取标题树
const tocTree = computed(() => {
  if (!markdownContent.value) return [] as TocNode[]
  const flat: { level: number; text: string; id: string }[] = []
  for (const line of markdownContent.value.split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.+)/)
    if (m) flat.push({ level: m[1].length, text: m[2].replace(/\*\*(.+?)\*\*/g, '$1').trim(), id: slugify(m[2]) })
  }
  // 构建树形结构
  const root: TocNode[] = [], stack: TocNode[] = []
  for (const h of flat) { const node: TocNode = { ...h, children: [] }; while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop(); if (stack.length) stack[stack.length - 1].children.push(node); else root.push(node); stack.push(node) }
  return root
})

// TOC 展开状态
const tocExpanded = ref<Record<string, boolean>>({}), activeTocId = ref('')

function tocToggleExpand(id: string) { tocExpanded.value[id] = !tocExpanded.value[id] }
function tocIsExpanded(n: TocNode): boolean { if (!n) return false; return tocExpanded.value[n.id] !== undefined ? tocExpanded.value[n.id] : false }

// 点击 TOC 项跳转
function tocNavigateTo(id: string) {
  activeTocId.value = id; tocExpanded.value[id] = true; currentSectionId.value = id
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

// ===== 生命周期 =====

// 初始化：加载文档树和进度
onMounted(async () => {
  try {
    tree.value = await fetchDocumentTree()
    progressMap.value = await fetchProgress()
    if (tree.value.length > 0) { const leaf = findFirstLeaf(tree.value); if (leaf) selectedKey.value = leaf }
  } catch (e) { console.error('Failed to load data:', e) }
})

// 查找第一个叶子节点
function findFirstLeaf(nodes: TreeNode[]): string | null { for (const n of nodes) { if (n.isLeaf) return n.key; if (n.children) { const l = findFirstLeaf(n.children); if (l) return l } } return null }

// 切换文档时加载内容
watch(selectedKey, async (key) => { if (!key || key.startsWith('category_')) return; loading.value = true; currentSectionId.value = ''; activeTocId.value = ''; try { const [content, parsed] = await Promise.all([fetchDocumentContent(key), fetchDocumentParsed(key)]); markdownContent.value = content; questionGroups.value = parsed.questionGroups; questions.value = parsed.questions; keyPoints.value = parsed.keyPoints } catch(e) { console.error(e) } finally { loading.value = false } })

// 切换学习状态
async function cycleProgress() { const key = selectedKey.value; if (!key) return; progressMap.value[key] = nextStatus[progressMap.value[key] || 'not_started']; await updateProgress(key, progressMap.value[key]) }
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <div class="app-root">
      <div class="top-nav">
        <!-- 移动端汉堡菜单按钮 -->
        <button v-if="isMobile" class="hamburger-btn" @click="sidebarVisible = true">☰</button>
        <div class="top-nav-brand">学习平台</div>
        <div class="top-nav-tabs">
          <button :class="{ active: activeTab === 'lecture' }" @click="activeTab = 'lecture'">📚 讲义学习</button>
          <button :class="{ active: activeTab === 'exam' }" @click="activeTab = 'exam'">📝 章节练习</button>
          <button :class="{ active: activeTab === 'wrong' }" @click="activeTab = 'wrong'">📕 错题本</button>
        </div>
      </div>
      <div class="app-body">
        <div v-show="activeTab === 'lecture'" class="app-layout">
          <!-- PC端：固定侧栏 -->
          <Sidebar v-if="!isMobile" :tree="tree" v-model:selected-key="selectedKey" :progress-map="progressMap" @update:progress-map="(key, status) => progressMap[key] = status" />
          <!-- 移动端：抽屉侧栏 -->
          <n-drawer v-if="isMobile" v-model:show="sidebarVisible" placement="left" :width="280">
            <Sidebar :tree="tree" v-model:selected-key="selectedKey" :progress-map="progressMap" @update:progress-map="(key, status) => { progressMap[key] = status; sidebarVisible = false }" @update:selected-key="sidebarVisible = false" />
          </n-drawer>
          <div class="main-area">
            <div v-if="selectedKey" class="topbar">
              <h1 class="topbar-title">{{ currentTitle }}</h1>
              <div class="topbar-actions">
                <n-tag :type="statusColors[currentStatus] as any" round size="medium" class="progress-tag" @click="cycleProgress">{{ statusLabels[currentStatus] }}</n-tag>
                <n-button size="small" @click="quizVisible = true">📝 本节题目</n-button>
                <n-button size="small" @click="aiVisible = true">💡 AI 导师</n-button>
              </div>
            </div>
            <div class="content-body" ref="contentBody"><n-spin :show="loading"><MarkdownView :content="markdownContent" /><KeyPointCard v-if="keyPoints.length" :key-points="keyPoints" /></n-spin></div>
          </div>
          <!-- PC端：固定右侧导航 -->
          <div v-if="!isMobile" class="right-panel">
            <div class="toc-panel"><div class="toc-title">章节导航</div>
              <div class="toc-nav" v-if="tocTree.length">
                <div v-for="node in tocTree" :key="node.id">
                  <span class="toc-item toc-l1" :class="{ active: activeTocId === node.id }" @click="tocNavigateTo(node.id)"><span v-if="node.children.length" class="toc-arr" :class="{ open: tocIsExpanded(node) }" @click.stop="tocToggleExpand(node.id)">▸</span><span v-else class="toc-arr" style="visibility:hidden">▸</span><span class="toc-label">{{ node.text }}</span></span>
                  <div v-if="tocIsExpanded(node)"><div v-for="h2 in node.children" :key="h2.id">
                    <span class="toc-item toc-l2" :class="{ active: activeTocId === h2.id }" @click="tocNavigateTo(h2.id)"><span v-if="h2.children.length" class="toc-arr" :class="{ open: tocIsExpanded(h2) }" @click.stop="tocToggleExpand(h2.id)">▸</span><span v-else class="toc-arr" style="visibility:hidden">▸</span><span class="toc-label">{{ h2.text }}</span></span>
                    <div v-if="tocIsExpanded(h2)"><span v-for="h3 in h2.children" :key="h3.id" class="toc-item toc-l3" :class="{ active: activeTocId === h3.id }" @click="tocNavigateTo(h3.id)">{{ h3.text }}</span></div>
                  </div></div>
                </div>
              </div>
            </div>
          </div>
          <!-- 移动端：浮动按钮 + 底部弹出导航 -->
          <button v-if="isMobile" class="toc-float-btn" @click="tocVisible = true">☰</button>
          <n-drawer v-if="isMobile" v-model:show="tocVisible" placement="bottom" :height="400">
            <div class="toc-panel toc-panel-mobile">
              <div class="toc-title toc-title-mobile">
                <span>章节导航</span>
                <button class="toc-close-btn" @click="tocVisible = false">✕</button>
              </div>
              <div class="toc-nav toc-nav-mobile" v-if="tocTree.length">
                <div v-for="node in tocTree" :key="node.id">
                  <span class="toc-item toc-l1" :class="{ active: activeTocId === node.id }" @click="tocNavigateTo(node.id); tocVisible = false"><span v-if="node.children.length" class="toc-arr" :class="{ open: tocIsExpanded(node) }" @click.stop="tocToggleExpand(node.id)">▸</span><span v-else class="toc-arr" style="visibility:hidden">▸</span><span class="toc-label">{{ node.text }}</span></span>
                  <div v-if="tocIsExpanded(node)"><div v-for="h2 in node.children" :key="h2.id">
                    <span class="toc-item toc-l2" :class="{ active: activeTocId === h2.id }" @click="tocNavigateTo(h2.id); tocVisible = false"><span v-if="h2.children.length" class="toc-arr" :class="{ open: tocIsExpanded(h2) }" @click.stop="tocToggleExpand(h2.id)">▸</span><span v-else class="toc-arr" style="visibility:hidden">▸</span><span class="toc-label">{{ h2.text }}</span></span>
                    <div v-if="tocIsExpanded(h2)"><span v-for="h3 in h2.children" :key="h3.id" class="toc-item toc-l3" :class="{ active: activeTocId === h3.id }" @click="tocNavigateTo(h3.id); tocVisible = false">{{ h3.text }}</span></div>
                  </div></div>
                </div>
              </div>
            </div>
          </n-drawer>
        </div>
        <div v-if="activeTab === 'exam'" class="app-page"><ExamPage /></div>
        <div v-if="activeTab === 'wrong'" class="app-page"><WrongBookPage /></div>
      </div>
      <!-- 移动端浮动按钮 -->
    </div>
    <AiModal :visible="aiVisible" :doc-id="selectedKey" :section-id="currentGroup?.sectionId || ''" :section-title="currentGroup?.section || ''" @update:visible="aiVisible = $event" />
    <n-modal :show="quizVisible" @update:show="quizVisible = $event"><div class="quiz-modal" :class="{ 'quiz-modal-mobile': isMobile }"><div class="quiz-modal-header"><span>📝 {{ currentGroup?.section || '本节题目' }}</span><n-button text size="small" @click="quizVisible = false">✕</n-button></div><SectionQuestions v-if="quizVisible && questionGroups.length" class="quiz-modal-body" :key="'quiz-' + currentSectionId" :questions="currentGroup?.questions || []" :document-id="selectedKey" :section-id="currentGroup?.sectionId || ''" /></div></n-modal>
  </n-config-provider>
</template>

<style>
:root {
  --ink-black: #2a241a; --ink-light: #5c5545; --paper-bg: #f8f4ed; --card-bg: #fefcf6; --paper-dark: #efe9de;
  --cinnabar-red: #b84c3c; --cinnabar-dark: #9a3e30; --bamboo-green: #4a6b4e; --bamboo-dark: #3a5640;
  --gray-100: #f5f2ec; --gray-200: #e8e3d8; --gray-300: #d4cec0; --gray-600: #8a8478; --gray-700: #5c5545; --gray-800: #3a3528;
  --font-display: 'Noto Serif SC', serif; --font-body: 'Noto Sans SC', sans-serif;
  --space-sm: 8px; --space-md: 16px; --space-lg: 24px; --radius: 10px; --radius-sm: 7px;
  --touch-target: 44px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; font-family: var(--font-body); background: var(--paper-bg); color: var(--ink-black); font-size: 15px; line-height: 1.75; }
.app-root { display: flex; flex-direction: column; height: 100vh; }

/* Top nav */
.top-nav { display: flex; align-items: center; padding: 0 24px; background: var(--card-bg); border-bottom: 1px solid var(--gray-300); height: 50px; flex-shrink: 0; }
.top-nav-brand { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; color: var(--cinnabar-red); margin-right: 32px; letter-spacing: .03em; }
.top-nav-tabs { display: flex; gap: 4px; }
.top-nav-tabs button { border: none; background: none; padding: 8px 18px; font-size: .9rem; font-family: var(--font-body); cursor: pointer; color: var(--gray-700); border-radius: 8px; transition: all .15s; font-weight: 500; }
.top-nav-tabs button:hover { background: var(--gray-100); color: var(--ink-black); }
.top-nav-tabs button.active { background: var(--cinnabar-red); color: #fff; font-weight: 600; }

/* 汉堡菜单按钮 */
.hamburger-btn {
  border: none; background: none; font-size: 1.5rem; cursor: pointer;
  color: var(--ink-black); padding: 8px 12px; margin-right: 8px;
  border-radius: 6px; transition: background .15s;
}
.hamburger-btn:hover { background: var(--gray-100); }

.app-body { flex: 1; min-height: 0; }
.app-page { height: 100%; overflow-y: auto; }

/* Lecture layout */
.app-layout { display: flex; height: 100%; }
.main-area { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.content-body { flex: 1; overflow-y: auto; padding: 28px 36px 48px; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 32px; background: var(--paper-bg);
  border-bottom: 1px solid var(--gray-300); flex-shrink: 0;
}
.right-panel { width: 290px; min-width: 290px; overflow-y: auto; background: var(--paper-dark); border-left: 1px solid var(--gray-300); }
.toc-panel { padding: 22px 0; }
.toc-title { font-family: var(--font-display); font-size: .95rem; font-weight: 700; color: var(--ink-black); padding: 0 22px 14px; border-bottom: 1px solid var(--gray-300); margin-bottom: 6px; position: relative; }
.toc-title::after { content: ''; position: absolute; bottom: -1px; left: 22px; width: 40px; height: 2px; background: var(--cinnabar-red); }
.toc-item { display: flex; align-items: center; gap: 4px; padding: 6px 22px; color: var(--gray-700); transition: all .12s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.6; cursor: pointer; font-size: .9rem; text-decoration: none; border-left: 2px solid transparent; }
.toc-item:hover { color: var(--cinnabar-red); background: var(--gray-100); }
.toc-item.active { color: var(--cinnabar-red); font-weight: 600; border-left-color: var(--cinnabar-red); }
.toc-label { overflow: hidden; text-overflow: ellipsis; }
.toc-arr { font-size: 16px; width: 28px; height: 28px; flex-shrink: 0; transition: transform .15s; color: var(--gray-600); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; font-weight: 700; }
.toc-arr:hover { background: var(--gray-200); }
.toc-arr.open { transform: rotate(90deg); }
.toc-l1 { font-weight: 600; color: var(--ink-black); }
.toc-l2 { padding-left: 36px; }
.toc-l3 { padding-left: 52px; font-size: .85rem; color: var(--gray-600); }

/* 移动端浮动按钮 */
.toc-float-btn {
  position: fixed; bottom: 20px; right: 20px;
  width: var(--touch-target); height: var(--touch-target);
  border-radius: 50%; border: none;
  background: var(--cinnabar-red); color: #fff;
  font-size: 1.3rem; cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,.2);
  z-index: 100; transition: transform .15s;
}
.toc-float-btn:hover { transform: scale(1.1); }

/* 移动端 TOC 面板 */
.toc-panel-mobile { padding: 0; height: 100%; display: flex; flex-direction: column; background: var(--card-bg); }
.toc-title-mobile {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--gray-200);
  font-family: var(--font-display); font-weight: 700;
}
.toc-close-btn { border: none; background: none; font-size: 1.2rem; cursor: pointer; color: var(--gray-600); padding: 4px 8px; }
.toc-nav-mobile { flex: 1; overflow-y: auto; }

.quiz-modal { background: var(--card-bg); border-radius: 14px; width: 640px; max-width: 90vw; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.12); }
.quiz-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid var(--gray-200); font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; color: var(--ink-black); }
.quiz-modal-body { padding: 24px; overflow-y: auto; flex: 1; }

/* 移动端弹窗全屏 */
.quiz-modal-mobile { width: 100%; max-width: 100%; max-height: 100%; height: 100%; border-radius: 0; }

/* ===== 移动端响应式 ===== */
@media (max-width: 768px) {
  .top-nav { padding: 0 12px; }
  .top-nav-brand { font-size: 1rem; margin-right: 12px; }
  .top-nav-tabs button { padding: 6px 12px; font-size: .85rem; }
  .content-body { padding: 16px 20px 32px; }
  .topbar { padding: 12px 16px; flex-wrap: wrap; gap: 8px; }
  .topbar-title { font-size: 1.1rem; }
  .topbar-actions { width: 100%; justify-content: flex-start; gap: 8px; }
}
</style>
