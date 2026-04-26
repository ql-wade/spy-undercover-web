import { useMemo } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { Container } from '../layout/Container'
import { Header } from '../layout/Header'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

/** 角色名称映射（模块常量，避免每次渲染重建） */
const ROLE_LABELS: Readonly<Record<string, string>> = {
  civilian: '平民',
  spy: '卧底',
  blank: '白板',
}

/** 角色颜色映射 */
const ROLE_COLORS: Readonly<Record<string, string>> = {
  civilian: 'text-success bg-success/20',
  spy: 'text-danger bg-danger/20',
  blank: 'text-warning bg-warning/20',
}

/** 角色图标 */
const ROLE_ICONS: Readonly<Record<string, string>> = {
  civilian: '👤',
  spy: '🕵️',
  blank: '📋',
}

/**
 * 投票结果页面（Sprint 3: 性能优化）
 *
 * - useMemo 缓存计算结果
 * - 常量提取到模块级别
 */
export function VoteResultScreen() {
  // === 细粒度状态订阅 ===
  const players = useGameStore((s) => s.players)
  const winner = useGameStore((s) => s.winner)
  const eliminatedOrder = useGameStore((s) => s.eliminatedOrder)
  const continueGame = useGameStore((s) => s.continueGame)
  const revealAll = useGameStore((s) => s.revealAll)

  // 缓存：被淘汰玩家信息
  const eliminatedInfo = useMemo(() => {
    const lastId = eliminatedOrder[eliminatedOrder.length - 1]
    return {
      player: lastId ? players.find((p) => p.id === lastId) : undefined,
      id: lastId,
    }
  }, [eliminatedOrder, players])

  // 缓存：存活玩家数
  const aliveCount = useMemo(
    () => players.filter((p) => p.isAlive).length,
    [players]
  )

  // 缓存：游戏是否结束
  const isGameOver = winner !== null

  // 缓存：胜利消息
  const winnerMessage = useMemo(() => {
    if (!winner) return null
    switch (winner) {
      case 'civilian':
        return '🎉 平民阵营获胜！'
      case 'spy':
        return '🕵️ 卧底获胜！'
      case 'blank':
        return '📋 白板获胜！'
      default:
        return null
    }
  }, [winner])

  return (
    <Container>
      <Header
        title={isGameOver ? '游戏结束' : '投票结果'}
        subtitle={
          eliminatedInfo.player
            ? `${eliminatedInfo.player.name} 被淘汰了`
            : undefined
        }
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
        {/* 被淘汰玩家信息卡片 */}
        {eliminatedInfo.player && (
          <div
            className={cn(
              'w-full max-w-xs rounded-radius-card border-2 p-6 text-center animate-[fadeIn_0.3s_ease-out]',
              eliminatedInfo.player.role === 'spy' && 'border-danger/50 bg-danger/5',
              eliminatedInfo.player.role === 'civilian' && 'border-success/50 bg-success/5',
              eliminatedInfo.player.role === 'blank' && 'border-warning/50 bg-warning/5'
            )}
          >
            {/* 图标 + 名字 */}
            <div className="text-5xl mb-3">
              {ROLE_ICONS[eliminatedInfo.player.role] ?? '❓'}
            </div>
            <h3 className="text-xl font-bold mb-1">{eliminatedInfo.player.name}</h3>

            {/* 身份标签 */}
            <span
              className={cn(
                'inline-block text-sm px-3 py-1 rounded-full font-medium mt-1',
                ROLE_COLORS[eliminatedInfo.player.role] ?? ''
              )}
            >
              {ROLE_LABELS[eliminatedInfo.player.role] ?? '未知'}
            </span>

            {/* 词语（仅非白板显示） */}
            {eliminatedInfo.player.word !== null ? (
              <div className="mt-4 p-3 bg-surface-dark rounded-[12px]">
                <p className="text-xs text-text-muted mb-1">TA 的词语</p>
                {/* 安全：JSX 文本插值，无 XSS 风险 */}
                <p className="text-2xl font-black tracking-wider">
                  {eliminatedInfo.player.word}
                </p>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-surface-dark rounded-[12px]">
                <p className="text-warning font-bold">— 无词语（白板）—</p>
              </div>
            )}
          </div>
        )}

        {/* 剩余存活信息 */}
        {!isGameOver && (
          <div className="text-center space-y-1">
            <p className="text-text-secondary text-sm">
              剩余{' '}
              <span className="text-text-primary font-bold text-lg tabular-nums">
                {aliveCount}
              </span>{' '}
              名玩家
            </p>
            <p className="text-text-muted text-xs">游戏继续...</p>
          </div>
        )}

        {/* 游戏结束提示 */}
        {isGameOver && winnerMessage && (
          <div
            className={cn(
              'text-center py-4 px-6 rounded-radius-card',
              winner === 'civilian' && 'bg-success/10 border border-success/30',
              winner === 'spy' && 'bg-danger/10 border border-danger/30',
              winner === 'blank' && 'bg-warning/10 border border-warning/30'
            )}
          >
            <p className="text-lg font-bold">{winnerMessage}</p>
          </div>
        )}
      </div>

      {/* 底部操作按钮 */}
      <div className="p-4 space-y-3 border-t border-white/5">
        {isGameOver ? (
          <Button variant="primary" size="lg" fullWidth onClick={revealAll}>
            👁 查看最终结果
          </Button>
        ) : (
          <>
            <Button variant="primary" size="lg" fullWidth onClick={continueGame}>
              ▶ 继续游戏
            </Button>
            <Button variant="ghost" size="md" fullWidth onClick={revealAll}>
              🔮 揭晓全部身份
            </Button>
          </>
        )}
      </div>
    </Container>
  )
}
