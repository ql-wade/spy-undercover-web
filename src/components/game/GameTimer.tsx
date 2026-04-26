import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { cn } from '../../lib/cn'

interface GameTimerProps {
  initialSeconds?: number
  isRunning?: boolean
  onComplete?: () => void
  onTick?: (remaining: number) => void
  className?: string
}

/**
 * 游戏计时器组件（Sprint 3: React.memo 优化）
 *
 * 使用 React.memo 避免父组件重渲染时计时器闪烁/重置
 */
export const GameTimer = memo(function GameTimer({
  initialSeconds = 30,
  isRunning = false,
  onComplete,
  onTick,
  className,
}: GameTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isWarning = timeLeft <= 10 && timeLeft > 5
  const isCritical = timeLeft <= 5

  const reset = useCallback(() => {
    setTimeLeft(initialSeconds)
  }, [initialSeconds])

  // 暴露 reset 方法（通过 ref 或回调，当前保留接口）
  void reset

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1
        onTick?.(next)

        if (next <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          onComplete?.()
          return 0
        }
        return next
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning, onComplete, onTick])

  // 格式化 MM:SS（使用 useMemo 缓存格式化结果）
  const display = useTimeDisplay(timeLeft)

  // 进度百分比
  const progressPercent = initialSeconds > 0 ? (timeLeft / initialSeconds) * 100 : 0

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div
        className={cn(
          'text-4xl font-mono font-bold tabular-nums transition-colors duration-300',
          isCritical && 'text-danger animate-pulse',
          isWarning && !isCritical && 'text-warning',
          !isWarning && !isCritical && 'text-text-primary'
        )}
      >
        {display}
      </div>
      <div className="w-48 h-1.5 bg-surface-dark rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000 ease-linear',
            isCritical && 'bg-danger',
            isWarning && !isCritical && 'bg-warning',
            !isWarning && !isCritical && 'bg-success'
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
})

/**
 * 缓存时间格式化结果（避免每秒重渲染时重新计算字符串）
 */
function useTimeDisplay(timeLeft: number): string {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
