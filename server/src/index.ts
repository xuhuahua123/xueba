/**
 * 学习平台后端入口
 * Fastify + SQLite + DeepSeek AI
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { initDb } from './db/index.js'
import { documentRoutes } from './routes/documents.js'
import { progressRoutes } from './routes/progress.js'
import { aiRoutes } from './routes/ai.js'
import { examRoutes } from './routes/exams.js'
import { wrongBookRoutes } from './routes/wrongBook.js'
import { examProgressRoutes } from './routes/examProgress.js'

// 初始化数据库
await initDb()

const server = Fastify({ logger: true })

// 允许跨域
await server.register(cors, { origin: '*' })

// 注册路由
await server.register(documentRoutes, { prefix: '/api' })
await server.register(progressRoutes, { prefix: '/api' })
await server.register(aiRoutes, { prefix: '/api' })
await server.register(examRoutes, { prefix: '/api' })
await server.register(wrongBookRoutes, { prefix: '/api' })
await server.register(examProgressRoutes, { prefix: '/api' })

// 启动服务
const port = parseInt(process.env.PORT || '3000')
await server.listen({ port, host: '0.0.0.0' })
console.log(`Server running at http://localhost:${port}`)
