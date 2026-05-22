# 学习平台 (xueba)

事业编公共基础知识学习系统：讲义渲染、AI 辅导、章节练习、错题本。

## 功能

- 📚 讲义学习：Markdown 渲染，支持数学公式、代码高亮
- 🤖 AI 辅导：DeepSeek 白话文解释考点
- ✍️ 章节练习：按科目刷题，自动记录进度
- 📝 错题本：错题自动收集，连续答对掌握

## 快速开始

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器
```

前端 http://localhost:5173，后端 API http://localhost:3000

## 环境变量

后端需要 `server/.env`：

```
DEEPSEEK_API_KEY=xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com  # 可选
```

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vue 3 + TypeScript + Naive UI |
| 构建 | Vite 5 |
| 后端 | Fastify 5 (ESM) |
| 数据库 | SQLite (sql.js) |
| AI | DeepSeek API |

## 项目结构

```
client/           前端
server/           后端
  src/db/         数据库操作
  src/routes/     API 路由
  src/services/   业务逻辑
  data/           SQLite 数据库
docment/          讲义 Markdown
examDatabase/     题库 JSON
```

## 部署

详见 `AGENTS.md`

## License

MIT
