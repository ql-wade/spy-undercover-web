import type {
  ApiResponse,
  WordsResponse,
  RandomWordsResponse,
  TodayWordsResponse,
} from '../types/game'

// ========== 配置 ==========

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 分钟缓存（§8.3 L1 内存 + L2 localStorage 缓存）
const L2_STORAGE_KEY = 'spy-undercover-api-cache' // L2 localStorage 键名

// ========== 缓存接口 ==========

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()

// ========== L2 localStorage 持久化缓存（§8.3）==========

/** L2 缓存条目接口 */
interface L2CacheEntry {
  data: unknown
  timestamp: number
}

/** 从 localStorage 读取 L2 缓存 */
function getL2Cached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(L2_STORAGE_KEY)
    if (!raw) return null
    const l2 = JSON.parse(raw) as Record<string, L2CacheEntry>
    const entry = l2[key]
    if (!entry) return null
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      // L2 过期，清理该条目
      delete l2[key]
      localStorage.setItem(L2_STORAGE_KEY, JSON.stringify(l2))
      return null
    }
    return entry.data as T
  } catch {
    // localStorage 不可用或数据损坏，静默失败
    return null
  }
}

/** 写入 L2 localStorage 缓存 */
function setL2Cache(key: string, data: unknown): void {
  try {
    const raw = localStorage.getItem(L2_STORAGE_KEY)
    const l2: Record<string, L2CacheEntry> = raw ? JSON.parse(raw) : {}
    l2[key] = { data, timestamp: Date.now() }
    localStorage.setItem(L2_STORAGE_KEY, JSON.stringify(l2))
  } catch {
    // localStorage 不可用或配额超限，静默失败
  }
}

/** 应用启动时从 L2 预热 L1 内存缓存 */
function warmupL1FromL2(): void {
  try {
    const raw = localStorage.getItem(L2_STORAGE_KEY)
    if (!raw) return
    const l2 = JSON.parse(raw) as Record<string, L2CacheEntry>
    const now = Date.now()
    for (const [key, entry] of Object.entries(l2)) {
      if (now - entry.timestamp <= CACHE_TTL_MS) {
        cache.set(key, entry as CacheEntry<unknown>)
      } else {
        delete l2[key]
      }
    }
    // 清理过期条目写回
    localStorage.setItem(L2_STORAGE_KEY, JSON.stringify(l2))
  } catch {
    // 静默失败
  }
}

// 应用启动时执行 L2 → L1 预热
warmupL1FromL2()

/** 缓存统计（性能监控） */
let cacheHits = 0
let cacheMisses = 0

function getCached<T>(key: string): T | null {
  // L1 内存缓存（热数据）
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) {
    // L1 未命中，尝试 L2 localStorage（页面刷新后的冷启动）
    const l2Data = getL2Cached<T>(key)
    if (l2Data) {
      // L2 命中，回填 L1
      cache.set(key, { data: l2Data, timestamp: Date.now() })
    }
    cacheMisses++
    return l2Data
  }
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key)
    cacheMisses++
    return null
  }
  cacheHits++
  return entry.data
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
  // 同步写入 L2 localStorage（持久化，刷新不丢失）
  setL2Cache(key, data)
}

// ========== 请求去重（§8.1 性能优化）==========

/**
 * 防止同一请求在飞行中重复发送
 *
 * 场景：多个组件同时挂载，都调用 fetchRandomWords()
 */
const pendingRequests = new Map<string, Promise<unknown>>()

async function deduplicatedFetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // 检查是否有相同 key 的请求正在进行
  const existing = pendingRequests.get(key) as Promise<T> | undefined
  if (existing) {
    return existing
  }

  const promise = fn().finally(() => {
    // 请求完成后清除（无论成功失败）
    pendingRequests.delete(key)
  })

  pendingRequests.set(key, promise)
  return promise
}

// ========== 错误处理（匹配架构 §3.2）==========

class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorBody: { success: false; error?: string; code?: string; retryAfter?: number } = {} as { success: false; error?: string; code?: string; retryAfter?: number }
    try {
      errorBody = await res.json()
    } catch {
      // 忽略解析错误
    }

    throw new ApiError(
      res.status,
      errorBody.code || 'INTERNAL',
      errorBody.error || `请求失败 (${res.status})`
    )
  }

  const json: ApiResponse<T> = await res.json()
  if (!json.success) {
    throw new ApiError(400, json.code || 'UNKNOWN', json.error || '未知错误')
  }
  return json.data!
}

// ========== API 方法 ==========

/**
 * 获取词库列表（分页、筛选）
 *
 * 性能优化：
 * - 内存缓存 (30min TTL)
 * - 请求去重（防止并发重复请求）
 */
export async function fetchWords(params?: {
  page?: number
  limit?: number
  difficulty?: string
  category?: string
}): Promise<WordsResponse> {
  const cacheKey = `words:${JSON.stringify(params)}`
  const cached = getCached<WordsResponse>(cacheKey)
  if (cached) return cached

  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.difficulty && params.difficulty !== 'random') searchParams.set('difficulty', params.difficulty)
  if (params?.category) searchParams.set('category', params.category)

  const query = searchParams.toString()
  const url = `${API_BASE}/words${query ? `?${query}` : ''}`

  const data = await deduplicatedFetch(cacheKey, async () =>
    handleResponse<WordsResponse>(await fetch(url))
  )
  setCache(cacheKey, data)
  return data
}

/**
 * 随机获取 N 对词语
 *
 * 性能优化：同上
 */
export async function fetchRandomWords(count = 1, difficulty?: string): Promise<RandomWordsResponse> {
  const cacheKey = `random:${count}:${difficulty || ''}`
  const cached = getCached<RandomWordsResponse>(cacheKey)
  if (cached) return cached

  const searchParams = new URLSearchParams({ count: String(count) })
  if (difficulty && difficulty !== 'random') searchParams.set('difficulty', difficulty)

  const data = await deduplicatedFetch(cacheKey, async () =>
    handleResponse<RandomWordsResponse>(
      await fetch(`${API_BASE}/words/random?${searchParams.toString()}`)
    )
  )
  setCache(cacheKey, data)
  return data
}

/**
 * 获取今日新词
 */
export async function fetchTodayWords(): Promise<TodayWordsResponse> {
  const cacheKey = 'today'
  const cached = getCached<TodayWordsResponse>(cacheKey)
  if (cached) return cached

  try {
    const data = await deduplicatedFetch(cacheKey, async () =>
      handleResponse<TodayWordsResponse>(await fetch(`${API_BASE}/words/today`))
    )
    setCache(cacheKey, data)
    return data
  } catch (err) {
    // NO_WORDS_TODAY 不是致命错误，返回空结果
    if (err instanceof ApiError && err.code === 'NO_WORDS_TODAY') {
      return { date: new Date().toISOString().split('T')[0]!, words: [], count: 0 }
    }
    throw err
  }
}

/**
 * 获取健康状态
 */
export async function fetchHealth(): Promise<{ status: string; version: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    const data = await handleResponse<{ status: string; version: string }>(res)
    return data
  } catch {
    return { status: 'offline', version: 'unknown' }
  }
}

// ========== 缓存调试 API（仅开发模式）==========

export function getCacheStats(): { hits: number; misses: number; size: number } {
  return {
    hits: cacheHits,
    misses: cacheMisses,
    size: cache.size,
  }
}
