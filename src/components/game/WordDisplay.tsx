import { useCallback, memo } from 'react'
import { cn } from '../../lib/cn'
import { useAntiPeek } from '../../hooks/useAntiPeek'

interface WordDisplayProps {
  word: string | null
  role: string
  label?: string
}

/**
 * 词语显示组件（Sprint 3: React.memo + 安全优化）
 *
 * - React.memo: 仅在 word/role/label 变化时更新
 * - 集成 useAntiPeek 防偷看机制
 * - 文本通过 JSX 表达式渲染（天然安全，无 innerHTML）
 */
export const WordDisplay = memo(function WordDisplay({ word, label }: WordDisplayProps) {
  const { isBlurred, showWord, hideWord } = useAntiPeek({ showDuration: 3000 })

  const handleToggle = useCallback(() => {
    if (isBlurred) {
      showWord()
    } else {
      hideWord()
    }
  }, [isBlurred, showWord, hideWord])

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <span className="text-sm text-text-secondary">{label}</span>
      )}

      {word !== null ? (
        <button
          className={cn(
            'relative px-8 py-4 bg-surface-dark rounded-radius-card border border-white/10',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer'
          )}
          onClick={handleToggle}
          aria-label={isBlurred ? '点击显示词语' : '点击隐藏词语'}
        >
          {/* 安全：使用 JSX 文本插值，非 innerHTML（XSS 免疫） */}
          <span
            className={cn(
              'text-4xl font-black tracking-wider transition-all duration-300 block',
              isBlurred && 'blur-lg select-none'
            )}
          >
            {word}
          </span>
        </button>
      ) : (
        <div className="px-8 py-4 bg-surface-dark rounded-radius-card border border-white/10 text-center">
          <span className="text-xl text-warning font-bold">— 白板 —</span>
          <p className="text-text-muted text-xs mt-1">无词语</p>
        </div>
      )}

      {/* 自动重模糊倒计时提示 */}
      {!isBlurred && (
        <p className="text-xs text-text-muted animate-[fadeIn_0.2s_ease-out]">
          👁 3秒后自动隐藏 · 点击可手动隐藏
        </p>
      )}

      {isBlurred && (
        <button
          className="text-sm text-text-secondary hover:text-text-primary underline underline-offset-4 cursor-pointer"
          onClick={handleToggle}
        >
          👁 显示词语
        </button>
      )}
    </div>
  )
})
