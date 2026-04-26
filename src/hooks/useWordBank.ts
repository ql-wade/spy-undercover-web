import { useState, useEffect, useCallback } from 'react'
import type { WordPair } from '../types/game'
import { builtinWords, getRandomWordPair } from '../data/builtin-words'
import { fetchRandomWords, fetchTodayWords } from '../services/wordApi'

interface UseWordBankReturn {
  words: WordPair[]
  todayWords: WordPair[]
  isLoading: boolean
  error: string | null
  refresh: () => void
  getRandomPair: (difficulty?: 'random' | 'easy' | 'medium' | 'hard') => WordPair
}

/**
 * 词库管理 Hook
 * 加载策略：内置词库（即时可用）→ 在线 API（增量补充）→ localStorage 缓存
 */
export function useWordBank(): UseWordBankReturn {
  const [words, setWords] = useState<WordPair[]>(builtinWords)
  const [todayWords, setTodayWords] = useState<WordPair[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOnlineWords = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 尝试拉取在线词库
      const randomResult = await fetchRandomWords(50)
      if (randomResult.words.length > 0) {
        // 合并在线词到内置词库（去重）
        const existingIds = new Set(builtinWords.map((w) => w.id))
        const newWords = randomResult.words.filter((w) => !existingIds.has(w.id))
        if (newWords.length > 0) {
          setWords((prev) => [...prev, ...newWords])
        }
      }

      // 尝试获取今日推荐
      try {
        const todayResult = await fetchTodayWords()
        if (todayResult.words.length > 0) {
          setTodayWords(todayResult.words)
        }
      } catch {
        // 今日词加载失败不阻塞主流程
      }
    } catch (err) {
      // 在线词库失败，降级到内置词库（始终可用）
      const message = err instanceof Error ? err.message : '词库加载失败'
      console.warn('[useWordBank] 在线词库不可用，使用内置词库:', message)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOnlineWords()
  }, [loadOnlineWords])

  const refresh = useCallback(() => {
    loadOnlineWords()
  }, [loadOnlineWords])

  const getRandomPair = useCallback(
    (difficulty?: 'random' | 'easy' | 'medium' | 'hard'): WordPair => {
      return getRandomWordPair(difficulty)
    },
    []
  )

  return {
    words,
    todayWords,
    isLoading,
    error,
    refresh,
    getRandomPair,
  }
}
