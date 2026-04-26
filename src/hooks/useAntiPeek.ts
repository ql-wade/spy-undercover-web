import { useState, useCallback, useRef, useEffect } from 'react'

interface UseAntiPeekOptions {
  /** 显示持续时间 (ms)，默认 3000 */
  showDuration?: number
  /** 是否自动重模糊，默认 true */
  autoReblur?: boolean
}

/**
 * 防偷看 Hook
 *
 * 提供模糊状态管理：blur → 点击显示 → timeout → 自动重模糊
 *
 * @example
 * ```tsx
 * const { isBlurred, showWord, hideWord } = useAntiPeek({ showDuration: 3000 })
 *
 * <span style={{ filter: isBlurred ? 'blur(12px)' : 'none' }}>
 *   {word}
 * </span>
 * <button onClick={showWord}>查看</button>
 * ```
 */
export function useAntiPeek(options?: UseAntiPeekOptions) {
  const [isBlurred, setIsBlurred] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const showDuration = options?.showDuration ?? 3000

  const showWord = useCallback(() => {
    setIsBlurred(false)
    clearTimeout(timerRef.current)

    if (options?.autoReblur !== false) {
      // 设置自动重模糊定时器
      timerRef.current = setTimeout(() => {
        setIsBlurred(true)
      }, showDuration)
    }
  }, [showDuration, options?.autoReblur])

  const hideWord = useCallback(() => {
    setIsBlurred(true)
    clearTimeout(timerRef.current)
  }, [])

  // 组件卸载时清理定时器，防止内存泄漏
  useEffect(() => () => {
    clearTimeout(timerRef.current)
  }, [])

  return { isBlurred, showWord, hideWord }
}
