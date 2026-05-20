<script setup lang="ts">
/**
 * 左侧边栏组件
 * 显示文档目录树，支持学习状态标记
 */
import { computed, h } from 'vue'
import type { TreeNode } from '@/api'
import { updateProgress } from '@/api'
import type { TreeOption } from 'naive-ui'

// ===== Props & Emits =====
const props = defineProps<{ tree: TreeNode[]; selectedKey: string; progressMap: Record<string, string> }>()
const emit = defineEmits<{
  'update:selectedKey': [key: string]
  'update:progressMap': [key: string, status: string]
}>()

// ===== 状态配置 =====
const statusLabels: Record<string, string> = { not_started: '未开始', learning: '学习中', completed: '已完成' }
const statusColors: Record<string, string> = { not_started: '#bab3a4', learning: '#b84c3c', completed: '#4a6b4e' }
const nextStatus: Record<string, string> = { not_started: 'learning', learning: 'completed', completed: 'not_started' }

// ===== 树形数据转换 =====
const treeData = computed(() => props.tree.map(cat => ({
  label: cat.label, key: cat.key,
  children: cat.children?.map(doc => ({ label: doc.label, key: doc.key, isLeaf: true }))
})))

// ===== 事件处理 =====

// 选择文档
function handleSelect(keys: string[]) { if (keys.length > 0) emit('update:selectedKey', keys[0]) }

// 切换学习状态（点击状态圆点）
async function cycleProgress(key: string) {
  const current = props.progressMap[key] || 'not_started'
  const next = nextStatus[current]
  await updateProgress(key, next)
  emit('update:progressMap', key, next)
}

// 自定义渲染：添加状态圆点
function renderLabel({ option }: { option: TreeOption }) {
  const key = option.key as string
  const status = props.progressMap[key] || 'not_started'
  return h('div', { style: 'display:flex;align-items:center;gap:8px;flex:1;padding:1px 0' }, [
    h('span', { style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.9rem;color:inherit' }, option.label as string),
    // 叶子节点显示状态圆点
    option.isLeaf && key ? h('span', {
      style: `display:inline-block;width:7px;height:7px;border-radius:50%;background:${statusColors[status]};flex-shrink:0;cursor:pointer`,
      title: statusLabels[status],
      onClick: (e: Event) => { e.stopPropagation(); cycleProgress(key) }
    }) : null
  ])
}
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>学习平台</h2>
      <div class="sidebar-subtitle">公共基础知识</div>
    </div>
    <div class="sidebar-tree">
      <n-tree :data="treeData" :selected-keys="[selectedKey]" :default-expand-all="true" :render-label="renderLabel" selectable block-line :indent="16" @update:selected-keys="handleSelect" />
    </div>
    <div class="sidebar-footer">
      <span class="legend-item"><span class="dot" style="background:#bab3a4"></span>未开始</span>
      <span class="legend-item"><span class="dot" style="background:#b84c3c"></span>学习中</span>
      <span class="legend-item"><span class="dot" style="background:#4a6b4e"></span>已完成</span>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 250px; min-width: 250px; height: 100vh;
  background: var(--paper-bg); color: var(--ink-black);
  display: flex; flex-direction: column; overflow: hidden;
  position: relative;
}
.sidebar::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--cinnabar-red), var(--bamboo-green), var(--cinnabar-red));
  opacity: .85; z-index: 1;
}
.sidebar-header {
  padding: 22px 18px 16px;
  border-bottom: 1px solid var(--gray-200);
  position: relative;
}
.sidebar-header h2 {
  font-family: var(--font-display); font-size: 1.4rem; font-weight: 700;
  color: var(--ink-black); margin: 0; letter-spacing: .03em;
  padding-bottom: var(--space-md);
  border-bottom: 2px solid var(--gray-300);
  position: relative;
}
.sidebar-header h2::after {
  content: ''; position: absolute; bottom: -2px; left: 0;
  width: 50px; height: 2px; background: var(--cinnabar-red);
}
.sidebar-subtitle { font-size: .8rem; color: var(--gray-600); margin-top: 6px; }
.sidebar-tree {
  flex: 1; overflow-y: auto; padding: 6px 4px;
  margin: var(--space-sm) 0;
}
.sidebar-tree :deep(.n-tree) { background: transparent; }
.sidebar-tree :deep(.n-tree-node) { color: var(--gray-700); font-size: .9rem; }
.sidebar-tree :deep(.n-tree-node-content) { padding: 4px 10px; border-radius: 6px; }
.sidebar-tree :deep(.n-tree-node-content:hover) { color: var(--cinnabar-red); }
.sidebar-tree :deep(.n-tree-node--selected .n-tree-node-content) {
  color: var(--cinnabar-red) !important; font-weight: 600 !important; background: none !important;
}
.sidebar-footer {
  padding: 12px 18px; border-top: 1px solid var(--gray-200);
  display: flex; gap: 16px; justify-content: center;
}
.legend-item { display: flex; align-items: center; gap: 4px; font-size: .75rem; color: var(--gray-600); }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
</style>
