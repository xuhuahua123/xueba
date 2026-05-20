/**
 * 章节练习路由
 * 提供题库科目列表和题目数据
 */
import { FastifyInstance } from 'fastify'
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 题库 JSON 文件目录
const EXAM_DIR = resolve(__dirname, '../../../examDatabase/parsed')

export async function examRoutes(app: FastifyInstance) {
  // 获取科目列表
  app.get('/exams', async () => {
    const files = readdirSync(EXAM_DIR).filter(f => f.endsWith('.json'))
    const list = files.map(f => {
      const raw = readFileSync(resolve(EXAM_DIR, f), 'utf-8')
      const data = JSON.parse(raw)
      return {
        id: f.replace('.json', ''),
        title: data.title,
        sections: data.sections.map((s: any) => ({
          type: s.type,
          label: s.label,
          count: s.questions.length
        })),
        total: data.sections.reduce((sum: number, s: any) => sum + s.questions.length, 0)
      }
    })
    return list
  })

  // 获取单个科目的所有题目
  app.get<{ Params: { id: string } }>('/exams/:id', async (req, reply) => {
    const { id } = req.params
    try {
      const raw = readFileSync(resolve(EXAM_DIR, `${id}.json`), 'utf-8')
      return JSON.parse(raw)
    } catch {
      return reply.status(404).send({ error: 'Exam not found' })
    }
  })
}
