/**
 * 章节练习进度路由
 * 记录答题情况，统计正确率
 */
import { FastifyInstance } from 'fastify'
import { saveExamAnswer, getExamProgress, getExamStats, resetMasteredExamProgress } from '../db/index.js'

export async function examProgressRoutes(app: FastifyInstance) {
  // 获取科目的答题进度和统计
  app.get<{ Params: { examId: string }; Querystring: { sectionIdx: string } }>('/exam-progress/:examId', async (req) => {
    const { examId } = req.params
    const sectionIdx = parseInt(req.query.sectionIdx || '0')
    // 清除已掌握题目的进度（从错题本掌握后重置）
    resetMasteredExamProgress(examId, sectionIdx)
    return {
      answers: getExamProgress(examId, sectionIdx),
      stats: getExamStats(examId)
    }
  })

  // 保存答题记录
  app.post<{ Body: { examId: string; sectionIdx: number; questionId: number; userAnswer: string; isCorrect: boolean } }>(
    '/exam-progress',
    async (req, reply) => {
      const { examId, sectionIdx, questionId, userAnswer, isCorrect } = req.body
      if (!examId || questionId === undefined) {
        return reply.status(400).send({ error: 'Missing fields' })
      }
      saveExamAnswer(examId, sectionIdx, questionId, userAnswer, isCorrect)
      return { ok: true }
    }
  )
}
