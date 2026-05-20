# 待完善事项

## 🔴 高优先级（安全/稳定性）

- [ ] CORS 配置过于宽松：`server/src/index.ts:21` 的 `origin: '*'` 应限制为特定域名
- [ ] AI API 调用无超时：`server/src/services/ai.ts:79` 的 fetch 无超时设置
- [ ] 路由无输入验证：多处使用 `as any` 直接解构 body，需添加 Zod 验证
- [ ] 文件读取无异常处理：`server/src/routes/exams.ts` 的 `readFileSync` 无 try-catch
- [ ] 前端静默吞错误：`ExamPage.vue:89,151` 的 `catch(() => {})` 应提示用户
- [ ] 缺少 `.env.example`：环境变量配置无示例文件
- [ ] API Key 错误提示不友好：DeepSeek 调用失败时应返回明确提示

## 🟠 中优先级（用户体验）

- [ ] 无加载骨架屏：App.vue、ExamPage.vue 加载时显示空白
- [ ] 错题本空状态简陋：WrongBookPage.vue 仅显示"暂无错题"
- [ ] 无离线提示：网络断开时用户无感知
- [ ] AI 加载无进度：仅显示"正在生成"，无预估时间
- [ ] 无搜索功能：讲义内容、题目无法搜索
- [ ] 无学习统计：缺少正确率趋势、学习时长等图表
- [ ] 无数据导出：学习进度、错题本无法备份
- [ ] 无收藏功能：重要题目/知识点无法标记
- [ ] 无深色模式：仅支持浅色主题

## 🟡 低优先级（代码质量/性能）

- [ ] `slugify` 重复定义：`parser.ts`、`ai.ts`、`utils/slugify.ts` 三处重复
- [ ] 未使用的依赖：`drizzle-orm` 已安装但未使用
- [ ] 死代码：`QuestionCard.vue` 存在但未被引用
- [ ] 魔法数字：`ai.ts` 的 4000 字符限制、0.3 温度应提取为常量
- [ ] 类型不严格：`wrongBook.ts` 使用 `as any` 绕过检查
- [ ] 数据库无索引：表缺少索引，数据量大时查询变慢
- [ ] 无请求缓存：每次切换文档都重新请求
- [ ] 无虚拟滚动：错题列表大量数据时性能下降
- [ ] Markdown 重复解析：每次渲染都重新解析，可缓存结果
- [ ] Naive UI 全量引入：建议按需加载减少包体积

## 📝 文档补充

- [ ] 无 API 文档：缺少 OpenAPI/Swagger
- [ ] 无贡献指南：缺少 CONTRIBUTING.md
- [ ] 无变更日志：缺少 CHANGELOG.md
- [ ] 无健康检查接口：生产环境需要 `/health` 端点

---

**统计**：高优先级 7 项，中优先级 9 项，低优先级 10 项，文档 4 项，共 30 项
