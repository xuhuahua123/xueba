/**
 * SQLite 数据库操作
 * 使用 sql.js（WebAssembly），无需原生编译
 * 数据文件：server/data/learn.db
 */
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_DATA = resolve(__dirname, '../../data')
const DB_PATH = resolve(PROJECT_DATA, 'learn.db')

let db: SqlJsDatabase

// 初始化数据库
export async function initDb() {
  // 确保 data 目录存在
  mkdirSync(PROJECT_DATA, { recursive: true })

  const SQL = await initSqlJs()

  // 加载已有数据库或创建新的
  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  // 启用 WAL 模式提升性能
  db.run('PRAGMA journal_mode = WAL')

  // 创建用户学习进度表
  db.run(`
    CREATE TABLE IF NOT EXISTS user_progress (
      document_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'not_started',
      updated_at INTEGER NOT NULL
    )
  `)

  // 创建错题本表
  db.run(`
    CREATE TABLE IF NOT EXISTS wrong_book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      question_index INTEGER NOT NULL,
      type TEXT NOT NULL,
      stem TEXT NOT NULL,
      options TEXT NOT NULL,
      answer TEXT NOT NULL,
      explanation TEXT NOT NULL,
      wrong_count INTEGER NOT NULL DEFAULT 1,
      consecutive_correct INTEGER NOT NULL DEFAULT 0,
      mastered INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // 创建 AI 解释缓存表
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_explanations (
      cache_key TEXT PRIMARY KEY,
      explanation TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  // 创建章节练习进度表
  db.run(`
    CREATE TABLE IF NOT EXISTS exam_progress (
      exam_id TEXT NOT NULL,
      section_idx INTEGER NOT NULL DEFAULT 0,
      question_id INTEGER NOT NULL,
      user_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      answered_at INTEGER NOT NULL,
      PRIMARY KEY (exam_id, section_idx, question_id)
    )
  `)

  saveDb()
  console.log(`SQLite initialized at ${DB_PATH}`)
}

// 保存数据库到文件
function saveDb() {
  const data = db.export()
  const buf = Buffer.from(data)
  writeFileSync(DB_PATH, buf)
}

// ===== 学习进度 =====
export function getProgress(): Record<string, string> {
  const rows = db.exec("SELECT document_id, status FROM user_progress")
  const map: Record<string, string> = {}
  if (rows[0]) {
    for (const row of rows[0].values) {
      map[row[0] as string] = row[1] as string
    }
  }
  return map
}

export function setProgress(documentId: string, status: string) {
  db.run(
    "INSERT INTO user_progress (document_id, status, updated_at) VALUES (?, ?, ?) ON CONFLICT(document_id) DO UPDATE SET status = ?, updated_at = ?",
    [documentId, status, Date.now(), status, Date.now()]
  )
  saveDb()
}

// ===== AI 解释缓存 =====
export function getExplanation(key: string): string | null {
  const rows = db.exec("SELECT explanation FROM ai_explanations WHERE cache_key = ?", [key])
  if (rows[0] && rows[0].values.length > 0) {
    return rows[0].values[0][0] as string
  }
  return null
}

export function setExplanation(key: string, text: string) {
  db.run(
    "INSERT INTO ai_explanations (cache_key, explanation, created_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET explanation = ?, created_at = ?",
    [key, text, Date.now(), text, Date.now()]
  )
  saveDb()
}

// ===== 错题本 =====
export function getWrongBook(): any[] {
  const rows = db.exec("SELECT * FROM wrong_book ORDER BY updated_at DESC")
  if (!rows[0]) return []
  return rows[0].values.map(row => ({
    id: row[0], documentId: row[1], questionIndex: row[2], type: row[3],
    stem: row[4], options: JSON.parse(row[5] as string),
    answer: row[6], explanation: row[7], wrongCount: row[8],
    consecutiveCorrect: row[9], mastered: !!row[10],
    createdAt: row[11], updatedAt: row[12]
  }))
}

// 添加错题（已存在则增加错误次数）
export function addWrongEntry(entry: {
  documentId: string; questionIndex: number; type: string; stem: string
  options: { label: string; text: string }[]; answer: string; explanation: string
}) {
  const existing = db.exec(
    "SELECT id, wrong_count FROM wrong_book WHERE document_id = ? AND question_index = ?",
    [entry.documentId, entry.questionIndex]
  )
  if (existing[0] && existing[0].values.length > 0) {
    const id = existing[0].values[0][0] as number
    const count = (existing[0].values[0][1] as number) + 1
    db.run(
      "UPDATE wrong_book SET wrong_count = ?, consecutive_correct = 0, mastered = 0, updated_at = ? WHERE id = ?",
      [count, Date.now(), id]
    )
  } else {
    db.run(
      "INSERT INTO wrong_book (document_id, question_index, type, stem, options, answer, explanation, wrong_count, consecutive_correct, mastered, created_at, updated_at) VALUES (?,?,?,?,?,?,?,1,0,0,?,?)",
      [entry.documentId, entry.questionIndex, entry.type, entry.stem,
       JSON.stringify(entry.options), entry.answer, entry.explanation,
       Date.now(), Date.now()]
    )
  }
  saveDb()
}

// 标记错题答对（连续答对2次标记为已掌握）
export function markCorrect(documentId: string, questionIndex: number) {
  db.run(
    "UPDATE wrong_book SET consecutive_correct = consecutive_correct + 1, updated_at = ? WHERE document_id = ? AND question_index = ?",
    [Date.now(), documentId, questionIndex]
  )
  db.run(
    "UPDATE wrong_book SET mastered = 1 WHERE document_id = ? AND question_index = ? AND consecutive_correct >= 2",
    [documentId, questionIndex]
  )
  saveDb()
}

// 删除错题
export function removeWrongEntry(id: number) {
  db.run("DELETE FROM wrong_book WHERE id = ?", [id])
  saveDb()
}

// ===== 章节练习进度 =====
export function saveExamAnswer(examId: string, sectionIdx: number, questionId: number, userAnswer: string, isCorrect: boolean) {
  db.run(
    "INSERT OR REPLACE INTO exam_progress (exam_id, section_idx, question_id, user_answer, is_correct, answered_at) VALUES (?,?,?,?,?,?)",
    [examId, sectionIdx, questionId, userAnswer, isCorrect ? 1 : 0, Date.now()]
  )
  saveDb()
}

export function getExamProgress(examId: string, sectionIdx: number): Record<string, string> {
  const rows = db.exec("SELECT question_id, user_answer FROM exam_progress WHERE exam_id = ? AND section_idx = ?", [examId, sectionIdx])
  const map: Record<string, string> = {}
  if (rows[0]) {
    for (const row of rows[0].values) {
      map[String(row[0])] = row[1] as string
    }
  }
  return map
}

export function getExamStats(examId: string): { answered: number; correct: number } {
  const rows = db.exec("SELECT COUNT(*), SUM(is_correct) FROM exam_progress WHERE exam_id = ?", [examId])
  if (rows[0] && rows[0].values.length > 0) {
    return {
      answered: Number(rows[0].values[0][0]) || 0,
      correct: Number(rows[0].values[0][1]) || 0
    }
  }
  return { answered: 0, correct: 0 }
}

// 清除已掌握题目的练习进度（从错题本掌握后，章节练习重置）
export function resetMasteredExamProgress(examId: string, sectionIdx: number) {
  db.run(`
    DELETE FROM exam_progress WHERE exam_id = ? AND section_idx = ? AND question_id IN (
      SELECT question_index FROM wrong_book WHERE document_id = ? AND mastered = 1
    )
  `, [examId, sectionIdx, `exam_${examId}`])
  saveDb()
}
