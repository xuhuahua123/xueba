/**
 * 错题本路由
 * 管理错题的添加、查询、标记正确
 */
import { FastifyInstance } from 'fastify'
import { getWrongBook, addWrongEntry, markCorrect } from '../db/index.js'

export async function wrongBookRoutes(app: FastifyInstance) {
  // 获取错题列表
  app.get('/wrong-book', async () => {
    return getWrongBook()
  })

  // 添加错题
  app.post('/wrong-book', async (req, reply) => {
    const { documentId, questionIndex, type, stem, options, answer, explanation, imageUrl } = req.body as any
    if (!documentId || questionIndex === undefined) {
      return reply.status(400).send({ error: 'Missing fields' })
    }
    addWrongEntry({ documentId, questionIndex, type, stem, options, answer, explanation, imageUrl })
    return { ok: true }
  })

  // 标记错题答对（连续答对2次自动标记为已掌握）
  app.post('/wrong-book/:id/correct', async (req, reply) => {
    const { id } = req.params as any
    const entries = getWrongBook()
    const entry = entries.find((e: any) => e.id === parseInt(id))
    if (!entry) return reply.status(404).send({ error: 'Not found' })
    markCorrect(entry.documentId, entry.questionIndex)
    return { ok: true }
  })
}
