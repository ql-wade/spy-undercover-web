/**
 * 性能优化工具模块（§8.1 性能目标）
 *
 * 提供 memoization 工具、性能标记、懒加载封装
 */
import { memo, type ComponentType, type ReactNode } from 'react'

// ========== 通用 Memo 封装 ==========

/**
 * 高阶组件：为组件添加 React.memo + 显示名称
 *
 * 用法：
 * ```tsx
 * export const MyComponent = memoNamed(function MyComponent(props) { ... })
 * ```
 */
export function memoNamed<T extends Record<string, unknown>>(
  component: (props: T) => ReactNode,
  displayName?: string
): ComponentType<T> {
  const Wrapped = memo(component) as unknown as ComponentType<T>
  ;(Wrapped as ComponentType<T>).displayName = displayName || (component.name || 'Anonymous')
  return Wrapped
}

// ========== 性能标记 ==========

/**
 * 性能测量标记（User Timing API）
 * 仅在开发模式下启用
 */
export function markStart(label: string): void {
  if (import.meta.env.DEV) {
    performance.mark(`${label}-start`)
  }
}

export function markEnd(label: string): void {
  if (import.meta.env.DEV) {
    performance.mark(`${label}-end`)
    performance.measure(label, `${label}-start`, `${label}-end`)
  }
}

// ========== 防抖工具 ==========

/**
 * 防抖函数（用于搜索输入等场景）
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timerId: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    clearTimeout(timerId)
    timerId = setTimeout(() => fn(...args), delayMs)
  }
}
