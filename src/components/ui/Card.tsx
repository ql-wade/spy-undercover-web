import { memo } from 'react'
import { cn } from '../../lib/cn'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

/**
 * 卡片容器组件（Sprint 3: React.memo 优化）
 */
export const Card = memo(function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-dark rounded-radius-card p-4 shadow-card-dark',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform duration-150',
        className
      )}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {children}
    </div>
  )
})
