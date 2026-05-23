/**
 * 章节练习路由
 * 提供题库科目列表和题目数据
 * 支持两个数据源：examDatabase/parsed/（文本题库）和 jsonExamBase/（图片题库）
 */
import { FastifyInstance } from 'fastify'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXAM_DIR = resolve(__dirname, '../../../examDatabase/parsed')
const IMAGE_EXAM_DIR = resolve(__dirname, '../../../jsonExamBase')

// 将图片题库 JSON 转换为 sections 格式
function convertImageExam(raw: string, fileName: string) {
  const items = JSON.parse(raw) as any[]
  const questions = items.map((q: any, idx: number) => ({
    id: idx + 1,
    stem: '',
    options: (q.options || []).map((label: string) => ({ label, text: '' })),
    answer: q.answer,
    explanation: '',
    image_url: q.image_url
  }))
  const title = fileName.replace('.json', '')
  return {
    title,
    sections: [{
      type: 'single',
      label: title,
      questions
    }]
  }
}

export async function examRoutes(app: FastifyInstance) {
  // 获取科目列表（合并两个数据源）
  app.get('/exams', async () => {
    const list: any[] = []

    // 文本题库
    const textFiles = readdirSync(EXAM_DIR).filter(f => f.endsWith('.json'))
    for (const f of textFiles) {
      const raw = readFileSync(resolve(EXAM_DIR, f), 'utf-8')
      const data = JSON.parse(raw)
      const total = data.sections.reduce((sum: number, s: any) => sum + s.questions.length, 0)
      if (total > 0) {
        list.push({
          id: f.replace('.json', ''),
          title: data.title,
          sections: data.sections.map((s: any) => ({ type: s.type, label: s.label, count: s.questions.length })),
          total
        })
      }
    }

    // 图片题库
    if (existsSync(IMAGE_EXAM_DIR)) {
      const imgFiles = readdirSync(IMAGE_EXAM_DIR).filter(f => f.endsWith('.json'))
      for (const f of imgFiles) {
        const raw = readFileSync(resolve(IMAGE_EXAM_DIR, f), 'utf-8')
        const items = JSON.parse(raw) as any[]
        list.push({
          id: f.replace('.json', ''),
          title: f.replace('.json', ''),
          sections: [{ type: 'single', label: f.replace('.json', ''), count: items.length }],
          total: items.length
        })
      }
    }

    return list
  })

  // 获取单个科目的所有题目
  app.get<{ Params: { id: string } }>('/exams/:id', async (req, reply) => {
    const { id } = req.params

    // 先查文本题库
    const textPath = resolve(EXAM_DIR, `${id}.json`)
    if (existsSync(textPath)) {
      const raw = readFileSync(textPath, 'utf-8')
      return JSON.parse(raw)
    }

    // 再查图片题库
    const imgPath = resolve(IMAGE_EXAM_DIR, `${id}.json`)
    if (existsSync(imgPath)) {
      const raw = readFileSync(imgPath, 'utf-8')
      return convertImageExam(raw, `${id}.json`)
    }

    return reply.status(404).send({ error: 'Exam not found' })
  })
}
