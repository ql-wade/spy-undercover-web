import { useMemo } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { Container } from '../layout/Container'
import { Header } from '../layout/Header'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

/** 胜利信息（模块常量） */
const WINNER_CONFIG: Readonly<Record<string, { emoji: string; label: string; color: string }>> = {
  civilian: { emoji: '🎉', label: '平民获胜！', color: 'text-success' },
  spy: { emoji: '🕵️', label: '卧底获胜！', color: 'text-danger' },
  blank: { emoji: '📋', label: '白板获胜！', color: 'text-warning' },
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
  civilian: '平民',
  spy: '卧底',
  blank: '白板',
}

const ROLE_BADGE_STYLES: Readonly<Record<string, string>> = {
  civilian: 'bg-success/20 text-success',
  spy: 'bg-danger/20 text-danger',
  blank: 'bg-warning/20 text-warning',
}

/**
 * 揭晓页面（Sprint 3: 性能优化）
 *
 * - useMemo 缓存玩家列表渲染数据
 * - 模块级常量避免重建
 */
export function RevealScreen() {
  // === 细粒度状态订阅 ===
  const players = useGameStore((s) => s.players)
  const winner = useGameStore((s) => s.winner)
  const selectedPair = useGameStore((s) => s.selectedPair)
  const resetGame = useGameStore((s) => s.resetGame)
  const eliminatedOrder = useGameStore((s) => s.eliminatedOrder)

  // 缓存：胜利信息
  const winnerInfo = useMemo(
    () => (winner ? WINNER_CONFIG[winner] : null),
    [winner]
  )

  // 缓存：玩家列表数据（预计算，避免在 map 中重复计算）
  const playerListData = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        isEliminated: eliminatedOrder.includes(player.id),
        eliminationOrder: eliminatedOrder.indexOf(player.id) + 1 || undefined,
      })),
    [players, eliminatedOrder]
  )

  return (
    <Container>
      <Header title="游戏结束" />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 胜利公告 */}
        {winnerInfo ? (
          <div className="text-center py-6 space-y-2">
            <div className="text-5xl">{winnerInfo.emoji}</div>
            <h2 className={cn('text-2xl font-black', winnerInfo.color)}>
              {winnerInfo.label}
            </h2>
          </div>
        ) : (
          <div className="text-center py-6">
            <h2 className="text-xl text-text-secondary">游戏结束</h2>
          </div>
        )}

        {/* 词对揭晓 */}
        {selectedPair && (
          <div className="bg-surface-dark rounded-radius-card p-4 text-center">
            <p className="text-xs text-text-muted mb-2">本局词对</p>
            <div className="flex items-center justify-center gap-4">
              <div>
                <p className="text-xs text-success">平民词</p>
                {/* 安全：JSX 文本插值 */}
                <p className="text-xl font-bold">{selectedPair.wordA}</p>
              </div>
              <span className="text-text-muted text-2xl">vs</span>
              <div>
                <p className="text-xs text-danger">卧底词</p>
                <p className="text-xl font-bold">{selectedPair.wordB}</p>
              </div>
            </div>
          </div>
        )}

        {/* 玩家身份列表 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-secondary">
            身份揭晓
          </h3>
          {playerListData.map((player, index) => (
            <div
              key={player.id}
              className={cn(
                'flex items-center gap-3 p-3 bg-surface-dark rounded-[12px]',
                !player.isAlive && 'opacity-50'
              )}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* 编号 */}
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-sm font-bold shrink-0">
                {player.id}
              </span>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{player.name}</span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      ROLE_BADGE_STYLES[player.role] ?? ''
                    )}
                  >
                    {ROLE_LABELS[player.role] ?? '未知'}
                  </span>
                </div>
                <span className="text-sm text-text-secondary">
                  {player.word ?? '— 无词语 —'}
                </span>
              </div>

              {/* 状态 */}
              <div className="text-right shrink-0">
                {player.isEliminated ? (
                  <span className="text-xs text-danger">
                    ❌ 第{player.eliminationOrder}名淘汰
                  </span>
                ) : (
                  <span className="text-xs text-success">✅ 存活</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部操作 */}
      <div className="p-4 space-y-3 border-t border-white/5">
        <Button variant="primary" size="lg" fullWidth onClick={resetGame}>
          🔄 再来一局
        </Button>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={() => {
            resetGame()
            useGameStore.setState({ phase: 'setup' })
          }}
        >
          🏠 返回设置
        </Button>
      </div>
    </Container>
  )
}
