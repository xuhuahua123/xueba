/**
 * 文件服务
 * 读取讲义目录并构建文档树
 */
import { readdir, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// 讲义目录路径
const DOCUMENT_DIR = resolve(__dirname, '../../../docment')

// 文档树节点
export interface TreeNode {
  label: string      // 显示名称
  key: string        // 唯一标识（文件名）
  category: string   // 一级分类
  number?: string    // 编号
  subject?: string   // 科目名称
  children?: TreeNode[]
  isLeaf?: boolean   // 是否为叶子节点（文件）
}

// 获取所有 Markdown 文件列表
async function getDocumentFiles(): Promise<{ name: string; path: string }[]> {
  const entries = await readdir(DOCUMENT_DIR, { withFileTypes: true })
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => ({
      name: e.name,
      path: join(DOCUMENT_DIR, e.name)
    }))
}

// 解析文件名：提取分类、编号、科目
// 格式：（{类别}）{编号}.{科目}-金牌讲义.md
function parseFileName(fileName: string): {
  category: string
  number?: string
  subject: string
} {
  const noExt = fileName.replace('.md', '')
  const match = noExt.match(/^[（(](.+?)[）)]\s*(?:(\d+)\.)?(.+)$/)
  if (match) {
    return {
      category: match[1],
      number: match[2] || undefined,
      subject: match[3]
    }
  }
  return { category: '其他', subject: noExt }
}

// 构建文档目录树（按分类分组）
export async function buildDocumentTree(): Promise<TreeNode[]> {
  const files = await getDocumentFiles()
  const categoryMap = new Map<string, TreeNode[]>()

  for (const file of files) {
    const { category, number, subject } = parseFileName(file.name)
    const key = file.name

    if (!categoryMap.has(category)) {
      categoryMap.set(category, [])
    }
    categoryMap.get(category)!.push({
      label: number ? `${number}. ${subject}` : subject,
      key,
      category,
      number,
      subject,
      isLeaf: true
    })
  }

  // 按编号排序并构建树
  const tree: TreeNode[] = []
  for (const [category, children] of categoryMap) {
    children.sort((a, b) => {
      const na = parseInt(a.number || '999')
      const nb = parseInt(b.number || '999')
      return na - nb
    })
    tree.push({
      label: category,
      key: `category_${category}`,
      category,
      children
    })
  }

  return tree
}

// 读取文档内容
export async function getDocumentContent(fileName: string): Promise<string> {
  const filePath = join(DOCUMENT_DIR, fileName)
  return readFile(filePath, 'utf-8')
}
