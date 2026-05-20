/**
 * AI 辅导路由
 * 为讲义章节生成白话文解释，支持缓存
 */
import { FastifyInstance } from 'fastify'
import { getDocumentContent } from '../services/files.js'
import { getOrGenerateExplanation } from '../services/ai.js'
import { getExplanation, setExplanation } from '../db/index.js'

export async function aiRoutes(app: FastifyInstance) {
  // 获取章节的 AI 白话文解释
  app.get<{ Params: { docId: string }; Querystring: { sectionId: string } }>(
    '/ai/explain/:docId',
    async (req, reply) => {
      const { docId } = req.params
      const { sectionId } = req.query

      if (!sectionId) {
        return reply.status(400).send({ error: 'sectionId required' })
      }

      try {
        const content = await getDocumentContent(docId)
        // 获取或生成解释（会自动缓存到数据库）
        const text = await getOrGenerateExplanation(
          docId,
          sectionId,
          content,
          (key) => getExplanation(key),
          (key, val) => setExplanation(key, val)
        )
        return { text, cached: getExplanation(`${docId}::${sectionId}`) !== null }
      } catch (err: any) {
        return reply.status(500).send({ error: err.message })
      }
    }
  )
}
