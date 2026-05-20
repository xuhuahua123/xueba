/**
 * 学习进度路由
 * 管理讲义的学习状态（未开始/学习中/已完成）
 */
import { FastifyInstance } from 'fastify'
import { getProgress, setProgress } from '../db/index.js'

export async function progressRoutes(app: FastifyInstance) {
  // 获取所有文档的学习进度
  app.get('/progress', async () => {
    return getProgress()
  })

  // 更新单个文档的学习状态
  app.put<{ Params: { documentId: string }; Body: { status: string } }>(
    '/progress/:documentId',
    async (req, reply) => {
      const { documentId } = req.params
      const { status } = req.body

      // 校验状态值
      if (!['not_started', 'learning', 'completed'].includes(status)) {
        return reply.status(400).send({ error: 'Invalid status' })
      }

      setProgress(documentId, status)
      return { ok: true, documentId, status }
    }
  )
}
