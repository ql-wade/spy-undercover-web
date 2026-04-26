import { useState, useCallback, memo } from 'react'
import { cn } from '../../lib/cn'
import { WordDisplay } from './WordDisplay'
import type { Player } from '../../types/game'

interface PlayerCardProps {
  player: Player
  isCurrentPlayer?: boolean
  onClick?: (playerId: number) => void
  compact?: boolean
}

/** 角色图标映射 */
const ROLE_ICONS: Record<string, string> = {
  civilian: '👤',
  spy: '🕵️',
  blank: '📋',
}

/** 角色名称映射 */
const ROLE_NAMES: Record<string, string> = {
  civilian: '平民',
  spy: '卧底',
  blank: '白板',
}

/** 角色颜色映射 */
const ROLE_COLORS: Record<string, string> = {
  civilian: 'text-success',
  spy: 'text-danger',
  blank: 'text-warning',
}

/**
 * 玩家卡片组件（Sprint 3: React.memo 优化）
 *
 * 使用 React.memo 避免无关 props 变化时重渲染：
 * - compact 模式下：仅在 player/isCurrentPlayer/selectedTarget 变化时更新
 * - 完整模式：仅在 player/isCurrentPlayer 变化时更新
 */
export const PlayerCard = memo(function PlayerCard({
  player,
  isCurrentPlayer = false,
  onClick,
  compact = false,
}: PlayerCardProps) {
  const [isFlipped, setIsFlipped] = useState(player.isRevealed)

  // 当 player 引用变化时（新发牌），重置状态
  // 注意：memo 已保证 player 不变时不重渲染

  const handleFlip = useCallback(() => {
    if (!player.isRevealed) {
      setIsFlipped(true)
      onClick?.(player.id)
    }
  }, [player.isRevealed, player.id, onClick])

  if (compact) {
    // 紧凑模式（投票/结果页用）
    return (
      <div
        className={cn(
          'relative bg-surface-dark rounded-radius-card p-3 border-2 transition-all duration-200',
          isCurrentPlayer && 'border-primary shadow-lg shadow-primary/20',
          !player.isAlive && 'opacity-40 grayscale',
          !isCurrentPlayer && 'border-transparent'
        )}
        role="button"
        tabIndex={0}
        aria-label={`${player.name} - ${ROLE_NAMES[player.role] ?? '未知'}`}
      >
        <div className="text-center">
          <div className="text-2xl mb-1">{ROLE_ICONS[player.role] ?? '❓'}</div>
          <div className="text-sm font-medium">{player.name}</div>
          {!player.isAlive && (
            <div className="text-xs text-danger mt-1">已淘汰</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('perspective mx-auto', isCurrentPlayer ? '' : '')}>
      {/* 卡片容器 */}
      <div
        className={cn(
          'card-inner relative w-full cursor-pointer',
          isFlipped && 'flipped'
        )}
        style={{ minHeight: compact ? 120 : 280 }}
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        aria-label={isFlipped ? `${player.name}的牌（已翻开）` : `${player.name}的牌，点击翻牌`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleFlip()
          }
        }}
      >
        {/* ====== 卡片背面 ====== */}
        <div className="card-face absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary to-purple-900 rounded-radius-card p-6">
          <div className="text-6xl mb-4 opacity-30">❓❓❓</div>
          <p className="text-white/70 text-lg">点击翻牌</p>
          <p className="text-white/50 text-sm mt-2">{player.name}</p>
          {isCurrentPlayer && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-white/20 rounded-full text-xs text-white">
              当前
            </div>
          )}
        </div>

        {/* ====== 卡片正面 ====== */}
        <div className="card-face card-back absolute inset-0 flex flex-col items-center justify-center bg-surface-dark rounded-radius-card p-6">
          {/* 角色标签 */}
          <div className={cn('flex items-center gap-2 mb-4', ROLE_COLORS[player.role] ?? '')}>
            <span className="text-3xl">{ROLE_ICONS[player.role] ?? '❓'}</span>
            <span className="text-lg font-bold">{ROLE_NAMES[player.role] ?? '未知'}</span>
          </div>

          {/* 词语显示（使用 WordDisplay 统一防偷看） */}
          <WordDisplay word={player.word} role={player.role} />

          {/* 玩家编号 */}
          <p className="absolute bottom-4 text-text-muted text-sm">
            {player.name}
          </p>
        </div>
      </div>
    </div>
  )
})
