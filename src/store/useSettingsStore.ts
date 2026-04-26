import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameConfig } from '../types/game'

/**
 * 用户偏好设置 Store
 *
 * 使用 Zustand persist 中间件自动持久化到 localStorage
 * 存储键名: "spy-undercover-settings"
 */

interface SettingsState {
  /** 主题设置 */
  theme: 'dark' | 'light' | 'system'
  /** 是否已看过引导页 */
  seenOnboarding: boolean
  /** 上次游戏配置（用于快速开始时自动填充） */
  lastGameConfig: GameConfig | null

  // --- Actions ---
  setTheme: (theme: SettingsState['theme']) => void
  markOnboardingSeen: () => void
  saveLastConfig: (config: GameConfig) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // --- 默认值 ---
      theme: 'dark',
      seenOnboarding: false,
      lastGameConfig: null,

      // --- Actions ---
      setTheme: (theme) => set({ theme }),

      markOnboardingSeen: () => set({ seenOnboarding: true }),

      saveLastConfig: (config) =>
        // 当前 GameConfig 全为原始类型，浅拷贝安全；
        // 使用 structuredClone 防御未来嵌套对象扩展时的意外引用共享
        set({ lastGameConfig: structuredClone(config) }),
    }),
    {
      name: 'spy-undercover-settings', // localStorage key
      // 只持久化这些字段（排除 actions）
      partialize: (state) => ({
        theme: state.theme,
        seenOnboarding: state.seenOnboarding,
        lastGameConfig: state.lastGameConfig,
      }),
    }
  )
)
