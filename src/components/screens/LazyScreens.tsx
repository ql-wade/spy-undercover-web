/**
 * 懒加载屏幕组件（§8.1 代码分割）
 *
 * 非首屏组件使用 React.lazy + Suspense 懒加载：
 * - VoteResultScreen: 投票结果页（游戏中期才用到）
 * - RevealScreen: 揭晓页（游戏结束才用到）
 *
 * 首屏组件（SetupScreen, DealingScreen, PlayingScreen, VotingScreen）保持同步加载
 */
import { lazy } from 'react'

/** 懒加载：投票结果页 */
export const LazyVoteResultScreen = lazy(
  () => import('./VoteResultScreen').then((m) => ({ default: m.VoteResultScreen }))
)

/** 懒加载：揭晓页 */
export const LazyRevealScreen = lazy(
  () => import('./RevealScreen').then((m) => ({ default: m.RevealScreen }))
)
