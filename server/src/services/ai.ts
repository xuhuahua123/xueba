/**
 * AI 服务
 * 调用 DeepSeek API 生成章节白话文解释
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 加载 .env 配置
config({ path: resolve(__dirname, '../../.env') })

// DeepSeek API 配置
const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

// 提取指定章节的内容
export function extractSectionContent(content: string, sectionId: string): string | null {
  const lines = content.split('\n')
  let startIdx = -1
  let startLevel = 0

  // 查找章节起始位置
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+(.+)/)
    if (m) {
      const text = m[2].replace(/\*\*(.+?)\*\*/g, '$1').trim()
      if (slugify(text) === sectionId) {
        startIdx = i
        startLevel = m[1].length
        break
      }
    }
  }

  if (startIdx === -1) return null

  // 查找章节结束位置（同级或更高级标题）
  let endIdx = lines.length
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+(.+)/)
    if (m) {
      const level = m[1].length
      if (level <= startLevel) {
        endIdx = i
        break
      }
    }
  }

  const contentLines = lines.slice(startIdx + 1, endIdx)
  // 移除 HTML 注释和分页标记
  const cleaned = contentLines
    .filter(l => !l.startsWith('<!--'))
    .join('\n')
    .trim()

  // 限制内容长度，避免 API 调用过长
  return cleaned.substring(0, 4000)
}

// 调用 DeepSeek API 生成白话文解释
export async function callDeepSeek(content: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

  const prompt = `你是公考辅导老师。请用通俗易懂的白话文解释以下内容。
要求：
1. 保留所有关键考点、数字、定义
2. 用口语化的方式讲，像老师在黑板前讲课
3. 适当使用比喻和生活中的例子
4. 输出用 Markdown 格式，层次清晰
5. 不要遗漏任何考点

原文内容：
${content}`

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096
    })
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`DeepSeek API error ${res.status}: ${errBody}`)
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}

// 获取或生成解释（优先使用缓存）
export async function getOrGenerateExplanation(
  docId: string,
  sectionId: string,
  content: string,
  getCache: (key: string) => string | null,
  setCache: (key: string, text: string) => void
): Promise<string> {
  const cacheKey = `${docId}::${sectionId}`
  const cached = getCache(cacheKey)
  if (cached) return cached

  const sectionContent = extractSectionContent(content, sectionId)
  if (!sectionContent) {
    throw new Error(`Section not found: ${sectionId}`)
  }

  const explanation = await callDeepSeek(sectionContent)
  setCache(cacheKey, explanation)
  return explanation
}

// 生成标题 ID
function slugify(text: string): string {
  return text
    .replace(/[（(]/g, '-')
    .replace(/[）)]/g, '')
    .replace(/[^\w\u4e00-\u9fff-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
