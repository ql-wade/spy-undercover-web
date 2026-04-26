import { memo, useCallback, useMemo } from 'react'
import { cn } from '../../lib/cn'
import type { Player } from '../../types/game'

interface VotePanelProps {
  players: Player[]
  voteResults: Record<number, number>
  selectedTarget: number | null
  onSelectTarget: (targetId: number | null) => void
  onConfirmVote: () => void
  currentVoterId?: number
}

/**
 * 投票面板组件（Sprint 3: React.memo 优化）
 *
 * 仅在 players/voteResults/selectedTarget 变化时重渲染
 */
export const VotePanel = memo(function VotePanel({
  players,
  voteResults,
  selectedTarget,
  onSelectTarget,
  onConfirmVote,
}: VotePanelProps) {
  // 预计算存活玩家列表
  const alivePlayers = useMemo(
    () => players.filter((p) => p.isAlive),
    [players]
  )

  const handleSelect = useCallback(
    (playerId: number) => {
      onSelectTarget(selectedTarget === playerId ? null : playerId)
    },
    [selectedTarget, onSelectTarget]
  )

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-center text-lg font-bold">
        🗳️ 投票环节
      </h3>
      <p className="text-center text-sm text-text-secondary">
        选择你认为的卧底
      </p>

      {/* 投票目标网格 */}
      <div className="grid grid-cols-3 gap-3">
        {alivePlayers.map((player) => {
          const isSelected = selectedTarget === player.id
          const votes = voteResults[player.id] || 0

          return (
            <button
              key={player.id}
              className={cn(
                'relative flex flex-col items-center gap-1 p-3 rounded-radius-card border-2 transition-all duration-200 cursor-pointer',
                isSelected
                  ? 'border-danger bg-danger/10 shadow-lg shadow-danger/20'
                  : 'border-white/5 bg-surface-dark hover:border-white/20'
              )}
              onClick={() => handleSelect(player.id)}
              aria-label={`投票给 ${player.name}，当前 ${votes} 票`}
              aria-pressed={isSelected}
            >
              <span className="text-lg font-semibold">{player.name}</span>
              {votes > 0 && (
                <span className="text-xs text-danger font-bold">
                  {votes} 票
                </span>
              )}
              {isSelected && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger rounded-full text-[10px] text-white flex items-center justify-center">
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 确认按钮 */}
      <button
        className="mt-2 w-full py-3 bg-danger text-white font-bold rounded-radius-btn hover:bg-red-600 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        disabled={!selectedTarget}
        onClick={() => {
          if (selectedTarget) {
            onConfirmVote()
          }
        }}
      >
        确认投票
      </button>
    </div>
  )
})
