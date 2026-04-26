import { memo } from 'react'
import { cn } from '../../lib/cn'

interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  className?: string
}

/**
 * 数字步进器（Sprint 3: React.memo 优化）
 */
export const Stepper = memo(function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
}: StepperProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-3">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-dark text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors text-xl leading-none cursor-pointer"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          aria-label={`减少${label}`}
        >
          −
        </button>
        <span className="w-8 text-center text-lg font-semibold tabular-nums">
          {value}
        </span>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-dark text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors text-xl leading-none cursor-pointer"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          aria-label={`增加${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
})
