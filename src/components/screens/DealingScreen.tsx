import { useEffect, useCallback, useMemo } from 'react'
import { useGameStore, selectCurrentPlayer, selectRevealedCount } from '../../store/useGameStore'
import { executeDeal } from '../../utils/dealing'
import { Container } from '../layout/Container'
import { Header } from '../layout/Header'
import { Button } from '../ui/Button'
import { PlayerCard } from '../game/PlayerCard'

/**
 * 发牌页面（Sprint 3: 性能优化）
 *
 * 优化点：
 * - 使用细粒度选择器 (selectCurrentPlayer, selectRevealedCount)
 * - useMemo 缓存计算结果
 * - useCallback 稳定回调引用
 */
export function DealingScreen() {
  // === 细粒度状态订阅（仅在自己关注的字段变化时重渲染）===
  const players = useGameStore((s) => s.players)
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex)
  const config = useGameStore((s) => s.config)
  const dealCardsAction = useGameStore((s) => s.dealCards)
  const revealOwnCard = useGameStore((s) => s.revealOwnCard)
  const finishDealing = useGameStore((s) => s.finishDealing)

  // 使用预构建选择器
  const currentPlayer = useGameStore(selectCurrentPlayer)
  const totalRevealed = useGameStore(selectRevealedCount)

  // 首次进入时自动执行发牌（使用统一发牌入口 executeDeal）
  useEffect(() => {
    if (players.length === 0) {
      const { players: dealtPlayers, wordPair } = executeDeal({
        playerCount: config.playerCount,
        spyCount: config.spyCount,
        blankCount: config.blankCount,
        difficulty: config.difficulty,
      })
      dealCardsAction(dealtPlayers)
      useGameStore.setState({ selectedPair: wordPair })
    }
  }, [players.length, config, dealCardsAction])

  // 缓存导航状态
  const navState = useMemo(() => ({
    isFirst: currentPlayerIndex === 0,
    isLast: currentPlayerIndex >= players.length - 1,
    allRevealed: totalRevealed === players.length && players.length > 0,
  }), [currentPlayerIndex, players.length, totalRevealed])

  const handleReveal = useCallback(
    (playerId: number) => {
      revealOwnCard(playerId)
    },
    [revealOwnCard]
  )

  const handleNext = useCallback(() => {
    if (!navState.isLast) {
      useGameStore.setState({ currentPlayerIndex: currentPlayerIndex + 1 })
    }
  }, [currentPlayerIndex, navState.isLast])

  const handlePrev = useCallback(() => {
    if (!navState.isFirst) {
      useGameStore.setState({ currentPlayerIndex: currentPlayerIndex - 1 })
    }
  }, [currentPlayerIndex, navState.isFirst])

  const handleFinishDealing = useCallback(() => {
    finishDealing()
  }, [finishDealing])

  const handleRedeal = useCallback(() => {
    // 使用统一发牌入口 executeDeal
    const { players: dealtPlayers, wordPair } = executeDeal({
      playerCount: config.playerCount,
      spyCount: config.spyCount,
      blankCount: config.blankCount,
      difficulty: config.difficulty,
    })
    dealCardsAction(dealtPlayers)
    useGameStore.setState({
      selectedPair: wordPair,
      currentPlayerIndex: 0,
    })
  }, [config, dealCardsAction])

  return (
    <Container>
      <Header
        title={`第 ${currentPlayerIndex + 1}/${players.length} 位玩家`}
        subtitle={`${totalRevealed}/${players.length} 已查看`}
        rightAction={
          <button
            onClick={handleRedeal}
            className="px-3 py-1.5 text-xs bg-surface-dark rounded-full text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            重新发牌
          </button>
        }
      />

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {currentPlayer ? (
          <PlayerCard
            player={currentPlayer}
            isCurrentPlayer={true}
            onClick={handleReveal}
          />
        ) : (
          <div className="text-text-muted">加载中...</div>
        )}
      </div>

      {/* 导航 + 提示 */}
      <div className="p-4 space-y-3 border-t border-white/5">
        <p className="text-center text-sm text-text-muted">
          💡 请查看后传递给下一位玩家
        </p>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            disabled={navState.isFirst}
            onClick={handlePrev}
          >
            ⬅ 上一位
          </Button>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            disabled={navState.isLast}
            onClick={handleNext}
          >
            下一位 ➡
          </Button>
        </div>

        {navState.allRevealed && (
          <Button variant="primary" size="md" fullWidth onClick={handleFinishDealing}>
            ✅ 全部查看完毕，开始游戏 →
          </Button>
        )}
      </div>
    </Container>
  )
}
