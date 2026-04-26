import { Suspense, useMemo } from 'react'
import { useGameStore } from './store/useGameStore'
import { Container } from './components/layout/Container'
import { SetupScreen } from './components/screens/SetupScreen'
import { DealingScreen } from './components/screens/DealingScreen'
import { PlayingScreen } from './components/screens/PlayingScreen'
import { VotingScreen } from './components/screens/VotingScreen'
import { LazyVoteResultScreen, LazyRevealScreen } from './components/screens/LazyScreens'

/**
 * 懒加载 fallback 组件
 *
 * 保持与现有布局一致的高度，避免 CLS（累积布局偏移）
 */
function ScreenFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-text-muted text-sm">加载中...</div>
    </div>
  )
}

/**
 * App 根组件 — 状态机分发器
 *
 * 路由方案：状态机驱动（无 React Router）
 * 游戏是线性有限状态机，phase 变量即路由
 *
 * 性能优化（Sprint 3）：
 * - VoteResultScreen / RevealScreen 使用 React.lazy 懒加载
 * - 首屏组件保持同步加载（SetupScreen = HomeScreen）
 * - 使用 Suspense 边界避免 fallback 闪烁
 *
 * 状态转换：
 *   idle → setup → dealing → playing → voting → voteResult → reveal
 */

/** 所有合法的 game phase */
const VALID_PHASES = ['idle', 'setup', 'dealing', 'playing', 'voting', 'voteResult', 'reveal'] as const

export default function App() {
  const phase = useGameStore((s) => s.phase)

  // 缓存 phase 的合法性检查结果（避免每次渲染重新计算）
  const isValidPhase = useMemo(
    () => VALID_PHASES.includes(phase as typeof VALID_PHASES[number]),
    [phase]
  )

  return (
    <Container>
      {/* 页面切换动画容器 */}
      <div className="flex-1 relative overflow-hidden">
        <div
          key={phase}
          className="absolute inset-0 animate-[pageIn_0.3s_ease-out]"
        >
          {/* === 首屏组件（同步加载）=== */}

          {/* idle 和 setup 都显示设置页（首页 = 设置页） */}
          {(phase === 'idle' || phase === 'setup') && <SetupScreen />}

          {phase === 'dealing' && <DealingScreen />}
          {phase === 'playing' && <PlayingScreen />}
          {phase === 'voting' && <VotingScreen />}

          {/* === 非首屏组件（懒加载 + Suspense）=== */}

          <Suspense fallback={<ScreenFallback />}>
            {phase === 'voteResult' && <LazyVoteResultScreen />}
            {phase === 'reveal' && <LazyRevealScreen />}
          </Suspense>

          {/* 兜底：未知状态显示设置页 */}
          {!isValidPhase && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-text-muted">未知游戏状态: {String(phase)}</p>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}
