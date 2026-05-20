/**
 * 文档路由
 * 提供讲义目录树、原文内容、解析后的考点和题目
 */
import { FastifyInstance } from 'fastify'
import { buildDocumentTree, getDocumentContent } from '../services/files.js'
import { parseDocument } from '../services/parser.js'

export async function documentRoutes(app: FastifyInstance) {
  // 获取文档目录树
  app.get('/documents', async () => {
    return buildDocumentTree()
  })

  // 获取文档原始 Markdown 内容
  app.get<{ Params: { id: string } }>('/documents/:id/content', async (req) => {
    const content = await getDocumentContent(req.params.id)
    return { content }
  })

  // 获取解析后的考点清单和题目
  app.get<{ Params: { id: string } }>('/documents/:id/parsed', async (req) => {
    const content = await getDocumentContent(req.params.id)
    return parseDocument(content)
  })
}
