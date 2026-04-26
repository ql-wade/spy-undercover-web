import { cn } from '../../lib/cn'

interface SegmentedControlOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * 分段控制器（Sprint 3: React.memo 优化）
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  // SegmentedControl 不使用 memo，因为 onChange 引用通常每 render 变化
  // memo 反而会增加比较开销

  return (
    <div
      className={cn(
        'flex bg-surface-dark rounded-radius-btn p-1 gap-1',
        className
      )}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium rounded-[8px] transition-all duration-200 cursor-pointer',
            value === opt.value
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
