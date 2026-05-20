/**
 * 讲义解析器
 * 从 Markdown 讲义中提取考点清单和真题
 */

// 题目类型定义
export interface Question {
  id: number
  type: 'single' | 'multi' | 'judge'  // 单选 | 多选 | 判断
  stem: string                         // 题干
  options: { label: string; text: string }[]  // 选项
  answer: string                       // 答案
  explanation: string                  // 解析
}

// 考点清单项
export interface KeyPoint {
  question: string  // 考点问题
  answer: string    // 考点答案
}

// 按章节分组的题目
export interface QuestionGroup {
  section: string      // 章节标题
  sectionId: string    // 章节ID（用于锚点跳转）
  questions: Question[]
}

// 解析后的文档结构
export interface ParsedDocument {
  keyPoints: KeyPoint[]        // 考点清单
  questions: Question[]        // 所有题目（扁平）
  questionGroups: QuestionGroup[]  // 按章节分组的题目
}

// 移除 HTML 注释
function cleanContent(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, '')
}

// 提取考点清单（从"### 考点清单"章节）
function extractKeyPoints(content: string): KeyPoint[] {
  const points: KeyPoint[] = []
  // 匹配考点清单章节内容
  const section = cleanContent(content).match(/###\s*考点清单\n\n([\s\S]*?)(?=\n###\s|\n##\s)/)

  if (!section) return points

  const text = section[1]
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    // 匹配 "考点1——xxx" 或 "考点1-xxx" 格式
    const match = line.match(/^考点\d+[——\-]\s*(.+)$/)
    if (match) {
      let answer = ''
      // 收集多行答案内容
      while (i + 1 < lines.length) {
        const next = lines[i + 1].trim()
        if (next.startsWith('考点') || next.startsWith('*') || next === '') break
        answer += (answer ? '\n' : '') + next
        i++
      }
      if (answer) {
        points.push({ question: match[1].trim(), answer })
      }
    }
  }

  return points
}

// 解析行内选项（如 "A.xxx　　B.xxx" 用全角空格分隔）
function splitInlineOptions(text: string): { label: string; text: string }[] {
  const results: { label: string; text: string }[] = []

  // 按2个及以上空格/全角空格分割
  const parts = text.split(/[\u3000\s]{2,}/)

  for (const part of parts) {
    const m = part.trim().match(/^([A-E])[.、．]\s*(.+)$/)
    if (m) {
      const label = m[1]
      const text = m[2].trim()
      // 过滤掉看起来像解析说明的文字
      if (text.length < 80 && !/^[A-E][.、]/.test(text)) {
        if (!/两项|三项|四项|错误|正确$/.test(text.substring(0, 10)) || text.length > 40) {
          results.push({ label, text })
        }
      }
    }
  }

  return results
}

// 提取所有题目（扁平数组）
function extractQuestions(content: string): Question[] {
  const groups = extractQuestionGroups(content)
  return groups.flatMap(g => g.questions)
}

// 提取按章节分组的题目
function extractQuestionGroups(content: string): QuestionGroup[] {
  const groups: QuestionGroup[] = []
  const cleaned = cleanContent(content)

  // 匹配所有"真题再现"章节，支持多种格式：#### 真题再现、**真题再现**、◎真题再现 等
  const sectionPattern = /(?:^|\n)((?:#{2,4})\s*)?\*{0,2}[◎⊙☆]?\s*真题再现\s*\*{0,2}\s*\n\n?([\s\S]*?)(?=\n(?:(?:#{1,4})\s|\*{0,2}[◎⊙☆]?\s*真题再现)|\n*$)/g
  let sectionMatch

  while ((sectionMatch = sectionPattern.exec(cleaned)) !== null) {
    const qHeadingLevel = sectionMatch[1] ? sectionMatch[1].length : 4
    const block = sectionMatch[2]

    // 向上查找最近的父级标题作为章节归属
    const prefix = cleaned.substring(0, sectionMatch.index)
    const parentMatch = findParentHeading(prefix, qHeadingLevel)
    const section = parentMatch || '其他题目'

    const questions: Question[] = []
    // 匹配题目：1.（单选）题干...
    const qRegex = /(?:^|\n)\s*\*{0,2}\d+\.\s*[（(]([^）)]*)[）)]\*{0,2}\s*([\s\S]*?)(?=\n\s*\*{0,2}\d+\.\s*[（(]|$)/g
    let qMatch

    while ((qMatch = qRegex.exec(block)) !== null) {
      const typeStr = qMatch[1].trim()
      // 判断题型
      let type: Question['type'] = 'single'
      if (typeStr.includes('多')) type = 'multi'
      else if (typeStr.includes('判断')) type = 'judge'

      const body = qMatch[2].trim()

      // 分离题干和选项
      const lines = body.split('\n')
      let stem = ''
      let optStartIdx = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        // 遇到选项行开始
        if (/^[A-E][.、．]/.test(line)) {
          optStartIdx = i
          break
        }
        if (line && !line.startsWith('【')) {
          stem += (stem ? ' ' : '') + line
        }
      }

      // 收集选项
      const options: Question['options'] = []
      for (let i = optStartIdx; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('【答案】') || line.startsWith('【解析】')) break
        if (line.startsWith('<!--')) continue
        if (!line) continue

        // 尝试解析行内选项
        const inlineOpts = splitInlineOptions(line)
        if (inlineOpts.length > 0) {
          options.push(...inlineOpts)
        } else {
          // 单行单选项格式
          const m = line.match(/^([A-E])[.、．]\s*(.+)$/)
          if (m && m[2].trim().length < 80) {
            options.push({ label: m[1], text: m[2].trim() })
          }
        }
      }

      // 提取答案和解析
      const answerMatch = body.match(/【答案】\s*([^\n\r]+)/)
      const explainMatch = body.match(/【解析】\s*([\s\S]+?)(?=\n*$)/)

      // 有效题目才加入
      if (answerMatch && (options.length >= 2 || type === 'judge')) {
        questions.push({
          id: questions.length + 1,
          type,
          stem,
          options,
          answer: answerMatch[1].trim(),
          explanation: explainMatch ? explainMatch[1].trim().replace(/\n{2,}/g, '\n') : ''
        })
      }
    }

    if (questions.length > 0) {
      groups.push({
        section,
        sectionId: slugify(section),
        questions
      })
    }
  }

  return groups
}

// 向上查找父级标题（用于确定题目归属的章节）
function findParentHeading(prefix: string, childLevel: number): string | null {
  const lines = prefix.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].trim().match(/^(#{1,3})\s+(.+)/)
    if (m) {
      const level = m[1].length
      const text = m[2].replace(/\*\*(.+?)\*\*/g, '$1').trim()
      // 跳过带括号编号的小节（如"（四）家庭美德"），这些不是真正的章节边界
      if (level < childLevel) {
        if (!/^[（(][一二三四五六七八九十]+[）)]/.test(text)) {
          return text
        }
      }
    }
  }
  return null
}

// 生成标题ID（用于锚点跳转）
function slugify(text: string): string {
  return text
    .replace(/[（(]/g, '-')
    .replace(/[）)]/g, '')
    .replace(/[^\w\u4e00-\u9fff-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// 主入口：解析 Markdown 文档
export function parseDocument(content: string): ParsedDocument {
  return {
    keyPoints: extractKeyPoints(content),
    questions: extractQuestions(content),
    questionGroups: extractQuestionGroups(content)
  }
}
