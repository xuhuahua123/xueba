/**
 * 后端 API 封装
 * 所有接口通过 /api 代理访问后端 :3000
 */

// ===== 类型定义 =====

// 文档树节点
export interface TreeNode {
  label: string       // 显示名称
  key: string         // 唯一标识
  category: string    // 一级分类
  number?: string     // 编号
  subject?: string    // 科目
  children?: TreeNode[]
  isLeaf?: boolean    // 是否叶子节点（文件）
}

// 题目
export interface Question {
  id: number
  type: 'single' | 'multi' | 'judge'  // 单选 | 多选 | 判断
  stem: string           // 题干
  options: { label: string; text: string }[]  // 选项
  answer: string         // 答案
  explanation: string    // 解析
}

// 考点
export interface KeyPoint {
  question: string
  answer: string
}

// 按章节分组的题目
export interface QuestionGroup {
  section: string
  sectionId: string
  questions: Question[]
}

// 解析后的文档
export interface ParsedDocument {
  keyPoints: KeyPoint[]
  questions: Question[]
  questionGroups: QuestionGroup[]
}

// ===== 请求封装 =====

const BASE = '/api'

// 通用请求函数
async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, opts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body}`.substring(0, 200))
  }
  return res.json()
}

// ===== 文档接口 =====

// 获取文档目录树
export async function fetchDocumentTree(): Promise<TreeNode[]> {
  return req('/documents')
}

// 获取文档原始内容
export async function fetchDocumentContent(id: string): Promise<string> {
  const data = await req<{ content: string }>(`/documents/${encodeURIComponent(id)}/content`)
  return data.content
}

// 获取解析后的考点和题目
export async function fetchDocumentParsed(id: string): Promise<ParsedDocument> {
  return req(`/documents/${encodeURIComponent(id)}/parsed`)
}

// ===== 学习进度接口 =====

// 获取学习进度
export async function fetchProgress(): Promise<Record<string, string>> {
  return req('/progress')
}

// 更新学习状态
export async function updateProgress(documentId: string, status: string): Promise<void> {
  await req('/progress/' + encodeURIComponent(documentId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
}

// ===== AI 接口 =====

// 获取章节的 AI 白话文解释
export async function fetchExplanation(docId: string, sectionId: string): Promise<{ text: string; cached: boolean }> {
  const params = new URLSearchParams({ sectionId })
  return req(`/ai/explain/${encodeURIComponent(docId)}?${params}`)
}

// ===== 错题本接口 =====

// 添加错题
export async function addWrongEntry(entry: {
  documentId: string; questionIndex: number; type: string; stem: string
  options: { label: string; text: string }[]; answer: string; explanation: string
}) {
  await req('/wrong-book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  })
}

// 获取错题列表
export async function getWrongBook(): Promise<any[]> {
  return req('/wrong-book')
}
