<script setup lang="ts">
/**
 * AI 导师弹窗组件
 * 调用 DeepSeek API 生成章节白话文解释
 * 移动端：全屏显示
 */
import { ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { fetchExplanation } from '@/api'
import { useResponsive } from '@/composables/useResponsive'

const props = defineProps<{ visible: boolean; docId: string; sectionId: string; sectionTitle: string }>()
const emit = defineEmits<{ 'update:visible': [boolean] }>()

// ===== 响应式布局 =====
const { isMobile } = useResponsive()

// ===== 状态 =====
const loading = ref(false); const error = ref(''); const html = ref(''); const cached = ref(false)
const md = new MarkdownIt({ html: true, linkify: true, typographer: true })

// ===== 监听弹窗打开 =====
watch(() => props.visible, async (vis) => {
  if (!vis) return
  cached.value = false; loading.value = true; error.value = ''; html.value = ''
  try {
    const res = await fetchExplanation(props.docId, props.sectionId)
    html.value = md.render(res.text)
    cached.value = !!res.cached  // 是否命中缓存
    loading.value = false
  } catch (e: any) { error.value = e.message || '生成失败'; loading.value = false }
})

// ===== 操作 =====
function close() { emit('update:visible', false) }

// 重新生成（强制调用 API）
function regenerate() {
  loading.value = true; error.value = ''; html.value = ''
  fetchExplanation(props.docId, props.sectionId).then(res => { html.value = md.render(res.text); cached.value = true; loading.value = false })
    .catch(e => { error.value = e.message || '生成失败'; loading.value = false })
}
</script>

<template>
  <n-modal :show="visible" :mask-closable="false" :style="isMobile ? 'width:100%;height:100%;max-width:100%' : 'width:660px;max-width:90vw'" transform-origin="center" @update:show="emit('update:visible', $event)">
    <div class="ai-modal" :class="{ 'ai-modal-mobile': isMobile }">
      <div class="ai-header">
        <h3>AI 导师 · {{ sectionTitle }}</h3>
        <div class="ai-header-r">
          <span v-if="cached" class="ai-badge">已缓存</span>
          <button class="ai-close" @click="close">✕</button>
        </div>
      </div>
      <div class="ai-body">
        <div v-if="loading" class="ai-loading"><div class="ai-spin"></div><p>AI 导师正在生成讲解…</p><p class="ai-sub">调用 DeepSeek，首次约 10-30 秒</p></div>
        <div v-else-if="error" class="ai-err">{{ error }}</div>
        <div v-else class="ai-content" v-html="html" />
      </div>
      <div class="ai-footer">
        <n-button size="small" :disabled="loading" @click="regenerate">重新生成</n-button>
        <n-button size="small" type="primary" @click="close">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>

<style scoped>
.ai-modal { background: var(--card-bg); border-radius: 14px; overflow: hidden; }
.ai-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 28px; border-bottom: 1px solid var(--gray-200); background: var(--gray-100); }
.ai-header h3 { margin: 0; font-family: var(--font-display); font-size: 1.05rem; font-weight: 700; color: var(--ink-black); }
.ai-header-r { display: flex; align-items: center; gap: 10px; }
.ai-badge { font-size: 11px; background: var(--cinnabar-red); color: #fff; padding: 2px 10px; border-radius: 12px; font-weight: 600; }
.ai-close { border: none; background: none; font-size: 20px; cursor: pointer; color: var(--gray-600); padding: 2px 8px; border-radius: 4px; transition: all .15s; }
.ai-close:hover { background: var(--gray-200); }
.ai-body { padding: 28px; min-height: 200px; max-height: 60vh; overflow-y: auto; }
.ai-loading { text-align: center; padding: 48px 0; color: var(--ink-light); }
.ai-spin { width: 40px; height: 40px; border: 3px solid var(--gray-200); border-top-color: var(--cinnabar-red); border-radius: 50%; margin: 0 auto 16px; animation: aiSpin .8s linear infinite; }
@keyframes aiSpin { to { transform: rotate(360deg); } }
.ai-sub { font-size: 12px; color: var(--gray-600); margin-top: 8px; }
.ai-err { color: var(--cinnabar-red); text-align: center; padding: 40px; }
.ai-content { font-size: 15px; line-height: 1.85; color: var(--ink-black); }
.ai-content :deep(h1), .ai-content :deep(h2), .ai-content :deep(h3) { margin: 18px 0 10px; font-family: var(--font-display); }
.ai-content :deep(p) { margin: 10px 0; }
.ai-content :deep(strong) { color: var(--cinnabar-red); }
.ai-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 28px; border-top: 1px solid var(--gray-200); background: var(--gray-100); }

/* 移动端全屏 */
.ai-modal-mobile { border-radius: 0; height: 100%; display: flex; flex-direction: column; }
.ai-modal-mobile .ai-body { flex: 1; max-height: none; }
</style>
