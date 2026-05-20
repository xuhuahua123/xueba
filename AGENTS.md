# 学习平台 (xueba)

事业编公共基础知识学习系统：讲义渲染、AI 辅导、章节练习、错题本。

## 项目结构

```
├── client/           Vue 3 + Vite + Naive UI + TypeScript
│   └── src/
│       ├── api/           后端 API 封装（fetch）
│       └── components/    Vue 组件
├── server/           Fastify + TypeScript (ESM, top-level await)
│   ├── src/
│   │   ├── db/            SQLite（sql.js，WebAssembly）
│   │   ├── routes/        API 路由
│   │   └── services/      文件读取、题目解析、AI 调用
│   └── data/              learn.db（运行时自动创建）
├── docment/          讲义 Markdown 文件
└── examDatabase/     题库
    └── parsed/           解析后的 JSON
```

## 启动命令

```bash
# 安装依赖（pnpm monorepo）
pnpm install

# 开发模式（并行启动前后端）
pnpm dev

# 或分别启动
pnpm dev:client   # 前端 :5173
pnpm dev:server   # 后端 :3000
```

前端代理 `/api` → `:3000`。后端监听 `0.0.0.0:3000`。

## 技术栈

| 层 | 选型 |
|---|------|
| 前端 | Vue 3 + TypeScript + Naive UI |
| 构建 | Vite 5 |
| Markdown | markdown-it + katex + highlight.js |
| 后端 | Fastify 5，ESM，top-level await |
| 数据库 | SQLite（sql.js，纯 WebAssembly） |
| AI | DeepSeek API |

## 讲义文件命名

格式：`（{类别}）{编号}.{科目}-金牌讲义.md`

- 括号内为一级分类
- 数字编号为排序依据
- 科目为二级节点
- 解析：`server/src/services/files.ts` → `parseFileName()`

## 讲义标题层级

**强制规则：`##` = 章，`###` = 节，其余用 `####`**

```
## 第X章 法理学         ← 章，h2
### 第X节 法的概述       ← 节，h3
#### 一、法的概念       ← 知识点，h4
#### 真题再现           ← 统一 h4
```

TOC 只显示到 h3。非 `第X节` 格式的 h3 必须降为 h4。

## 题目格式

```
#### 真题再现

1. （单选/多选）题干
A. 选项A　　B. 选项B
C. 选项C　　D. 选项D
【答案】ABD
【解析】解释文本
```

支持单选、多选、判断题。解析：`server/src/services/parser.ts`

## 数据库

`server/data/learn.db`（运行时创建）：

| 表 | 说明 |
|----|------|
| `user_progress` | 学习进度 |
| `wrong_book` | 错题本 |
| `ai_explanations` | AI 缓存 |
| `exam_progress` | 做题记录 |

每次写操作立即存盘。

## API

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/documents` | GET | 文档目录树 |
| `/api/documents/:id/content` | GET | 文档原文 |
| `/api/documents/:id/parsed` | GET | 解析后考点+题目 |
| `/api/progress` | GET/PUT | 学习进度 |
| `/api/ai/explain/:docId` | GET | AI 白话文 |
| `/api/exams` | GET | 科目列表 |
| `/api/exams/:id` | GET | 科目题目 |
| `/api/exam-progress/:examId` | GET | 做题进度 |
| `/api/exam-progress` | POST | 保存答题 |
| `/api/wrong-book` | GET/POST | 错题本 |
| `/api/wrong-book/:id/correct` | POST | 标记正确 |

## 代码规范

- 后端 ESM，import 需要 `.js` 后缀
- 前端 `@` 别名指向 `./src`
- 组件 `<script setup lang="ts">`
- Naive UI 全局注册，直接用 `<n-xxx>`

## 移动端适配

### 响应式断点

| 断点 | 宽度 | 设备 |
|------|------|------|
| 移动端 | < 768px | 手机 |
| 平板 | 768px - 1024px | 平板竖屏/横屏 |
| 桌面 | > 1024px | 桌面显示器 |

### 实现方式

使用 `useResponsive` Hook 检测断点：

```typescript
import { useResponsive } from '@/composables/useResponsive'
const { isMobile, isTablet, isDesktop } = useResponsive()
```

内部基于 `window.innerWidth` + Vue 响应式实现，无需额外依赖。

### 页面适配策略

| 页面 | 桌面 | 移动端 |
|------|------|--------|
| 讲义学习 | 三栏：目录 + 内容 + 章节导航 | 单栏：抽屉目录 + 内容 + 浮动按钮导航 |
| 章节练习 | 三栏：科目 + 题目 + 答题卡 | 单栏：下拉选科目 + 题目 + 浮动按钮弹出答题卡 |
| 错题本 | 双栏：列表 + 详情 | 单栏：列表/详情切换 |

### 触控优化

- 最小触控目标：44px（`--touch-target`）
- 移动端选项 padding 增大
- 底部固定元素预留安全距离

### 文件结构

```
client/src/
├── composables/
│   └── useResponsive.ts   # 响应式 Hook（原生实现）
├── App.vue                # 主布局 + 移动端抽屉
└── components/
    ├── ExamPage.vue       # 章节练习移动端适配
    ├── WrongBookPage.vue  # 错题本移动端适配
    └── AiModal.vue        # AI 弹窗移动端全屏
```

## 部署

服务器：`119.29.16.37`，访问 **http://119.29.16.37**

**重要**：打包时排除 `server/data`，避免覆盖云端数据库。

```bash
# 1. 打包（排除数据库、node_modules、macOS 扩展属性文件）
COPYFILE_DISABLE=1 tar czf /tmp/xueba.tar.gz \
  --exclude=node_modules \
  --exclude=server/data \
  client server docment examDatabase AGENTS.md

# 2. 上传
scp /tmp/xueba.tar.gz root@119.29.16.37:/opt/xueba/

# 3. 解压、安装依赖、构建前端、重启
ssh root@119.29.16.37 "cd /opt/xueba && tar xzf xueba.tar.gz && pnpm install && pnpm build && pm2 restart xueba-api"

**注意**：如果 `pnpm build` 报类型错误，可能需要跳过类型检查：
```bash
# 修改 client/package.json 的构建脚本
sed -i 's/\"build\": \"vue-tsc -b && vite build\"/\"build\": \"vite build\"/' client/package.json
```
```

### 架构

```
用户 → :80 (nginx)
         ├── /      → /opt/xueba/client/dist（前端静态文件）
         └── /api/* → proxy → :3000 (Fastify API)
```

| 项 | 值 |
|----|-----|
| 项目目录 | `/opt/xueba/` |
| API 进程 | `pm2 start xueba-api` |
| 数据库 | `/opt/xueba/server/data/learn.db` |

### 常用命令

```bash
pm2 status              # 查看状态
pm2 restart xueba-api   # 重启 API
pm2 logs xueba-api      # 查看日志
```
