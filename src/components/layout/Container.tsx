import { memo } from 'react'
import { cn } from '../../lib/cn'
import type { ReactNode } from 'react'

interface ContainerProps {
  children: ReactNode
  className?: string
}

/**
 * 统一屏幕容器（Sprint 3: React.memo 优化）
 *
 * max-width 居中，全屏高度，移动端优先
 */
export const Container = memo(function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        'min-h-dvh w-full max-w-[430px] mx-auto flex flex-col bg-bg-dark',
        className
      )}
    >
      {children}
    </div>
  )
})
