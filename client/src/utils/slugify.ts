/**
 * 标题 ID 生成
 * 将标题文本转为 URL 安全的锚点 ID
 */
export function slugify(text: string): string {
  return text
    .replace(/[（(]/g, '-')    // 中文/英文左括号转连字符
    .replace(/[）)]/g, '')     // 移除右括号
    .replace(/[^\w\u4e00-\u9fff-]/g, '-')  // 非字母数字汉字转连字符
    .replace(/-+/g, '-')       // 多个连字符合并
    .replace(/^-|-$/g, '')     // 移除首尾连字符
}
