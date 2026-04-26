import { memo } from 'react'
import { cn } from '../../lib/cn'
import type { ReactNode } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  rightAction?: ReactNode
  className?: string
}

/**
 * 应用头部组件（Sprint 3: React.memo 优化）
 */
export const Header = memo(function Header({ title, subtitle, onBack, rightAction, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b border-white/5',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-text-secondary transition-colors cursor-pointer"
            aria-label="返回"
          >
            ←
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold">{title}</h1>
          {subtitle && (
            <p className="text-xs text-text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {rightAction && <div>{rightAction}</div>}
    </header>
  )
})
