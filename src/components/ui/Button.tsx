import { memo } from 'react'
import { cn } from '../../lib/cn'
import type { ReactNode, ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  children: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-light active:scale-[0.97] shadow-lg shadow-primary/25',
  secondary:
    'bg-surface-dark text-text-secondary border border-text-muted/30 hover:border-primary/50 hover:text-text-primary',
  danger:
    'bg-danger text-white hover:bg-red-600 active:scale-[0.97]',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-white/5',
  outline:
    'border-2 border-primary text-primary hover:bg-primary/10',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm rounded-radius-btn',
  md: 'px-6 py-3 text-base font-medium rounded-radius-btn',
  lg: 'px-8 py-4 text-lg font-semibold rounded-radius-btn',
}

/**
 * 按钮组件（Sprint 3: React.memo 优化）
 *
 * 基础 UI 组件使用 memo 减少不必要的重渲染
 */
export const Button = memo(function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-medium',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
})
