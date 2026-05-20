<script setup lang="ts">
/**
 * Markdown 渲染组件
 * 支持：代码高亮、KaTeX 公式、标题锚点
 */
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import markdownItKatex from '@iktakahiro/markdown-it-katex'
import hljs from 'highlight.js'
import { slugify } from '@/utils/slugify'
import 'highlight.js/styles/github.css'

const props = defineProps<{ content: string }>()

// ===== Markdown 渲染器配置 =====
const md = new MarkdownIt({
  html: true, linkify: true, typographer: true,
  // 代码高亮
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try { return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>` } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  }
})
// 启用 KaTeX 数学公式
md.use(markdownItKatex)

// ===== 标题锚点 =====
// 为 h1-h4 添加 id 属性，用于目录跳转
const dh = md.renderer.rules.heading_open || ((t, i, o, _e, s) => s.renderToken(t, i, o))
md.renderer.rules.heading_open = function (tokens, idx, options, _env, self) {
  const token = tokens[idx]
  const level = parseInt(token.tag.substring(1))
  if (level >= 1 && level <= 4) {
    const nt = tokens[idx + 1]
    if (nt && nt.type === 'inline') token.attrSet('id', slugify(nt.content.replace(/<\/?[^>]+>/g, '')))
  }
  return dh(tokens, idx, options, _env, self)
}

// ===== 渲染计算 =====
const renderedHtml = computed(() => {
  if (!props.content) return ''
  // 移除 HTML 注释
  return md.render(props.content.replace(/<!--[\s\S]*?-->/g, ''))
})
</script>

<template><div class="markdown-body" v-html="renderedHtml" /></template>

<style>
.markdown-body {
  background: var(--card-bg); border-radius: var(--radius);
  padding: 38px 46px; line-height: 1.85; color: var(--ink-black); font-size: 15px;
  max-width: 880px; margin: 0 auto;
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
}
.markdown-body h1 {
  font-family: var(--font-display); font-size: 2rem; font-weight: 700;
  margin: 38px 0 22px; padding-bottom: 14px;
  border-bottom: 2px solid var(--gray-300); position: relative;
  scroll-margin-top: 24px; color: var(--ink-black);
}
.markdown-body h1:first-child { margin-top: 0; }
.markdown-body h1::after {
  content: ''; position: absolute; bottom: -2px; left: 0;
  width: 60px; height: 2px; background: var(--cinnabar-red);
}
.markdown-body h2 {
  font-family: var(--font-display); font-size: 1.5rem; font-weight: 700;
  margin: 32px 0 16px; color: var(--ink-black); scroll-margin-top: 24px;
}
.markdown-body h3 {
  font-size: 1.2rem; font-weight: 600; margin: 24px 0 12px;
  color: var(--gray-800); scroll-margin-top: 24px;
}
.markdown-body h4 {
  font-size: 1.05rem; font-weight: 600; margin: 18px 0 8px;
  color: var(--ink-light); scroll-margin-top: 24px;
}
.markdown-body p { margin: 12px 0; }
.markdown-body ul, .markdown-body ol { padding-left: 26px; margin: 10px 0; }
.markdown-body li { margin: 5px 0; }
.markdown-body blockquote {
  border-left: 3px solid var(--cinnabar-red); padding: 12px 18px; margin: 16px 0;
  background: var(--gray-100); border-radius: 0 6px 6px 0; color: var(--ink-light);
  font-size: 14px;
}
.markdown-body table {
  border-collapse: separate; border-spacing: 0; width: 100%; margin: 16px 0;
  border-radius: 6px; overflow: hidden; border: 1px solid var(--gray-200); font-size: 14px;
}
.markdown-body th {
  background: var(--gray-100); font-weight: 600; color: var(--ink-black);
  padding: 9px 14px; text-align: left; border-bottom: 1px solid var(--gray-200);
}
.markdown-body td { padding: 9px 14px; border-bottom: 1px solid var(--gray-100); }
.markdown-body tr:last-child td { border-bottom: none; }
.markdown-body tr:nth-child(even) td { background: rgba(0,0,0,.01); }
.markdown-body tr:hover td { background: var(--gray-100); }
.markdown-body code {
  background: rgba(184,76,60,.07); padding: 2px 6px; border-radius: 4px;
  font-size: 13px; font-family: 'Fira Code', 'Consolas', monospace; color: #b84c3c;
}
.markdown-body pre {
  background: var(--gray-100); padding: 16px; border-radius: 6px;
  overflow-x: auto; margin: 14px 0; border: 1px solid var(--gray-200);
}
.markdown-body pre code { background: none; padding: 0; color: inherit; }
.markdown-body strong { color: var(--ink-black); }
.markdown-body img { max-width: 100%; border-radius: 4px; }
.markdown-body .katex-display { margin: 14px 0; overflow-x: auto; }

@media (max-width: 768px) { .markdown-body { padding: 24px 28px; max-width: 100%; } }
</style>
