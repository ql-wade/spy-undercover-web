import { useCallback } from 'react'
import { useGameStore } from '../store/useGameStore'
import { executeDeal } from '../utils/dealing'
import type { GameConfig } from '../types/game'

interface UseGameLogicReturn {
  /** 开始新游戏 */
  startNewGame: (config?: Partial<GameConfig>) => void
  /** 翻开当前玩家卡片 */
  revealCurrentCard: () => void
  /** 切换到下一位玩家 */
  goToNextPlayer: () => void
  /** 切换到上一位玩家 */
  goToPrevPlayer: () => void
  /** 完成发牌阶段 */
  finishDealingPhase: () => void
  /** 下一位发言者 */
  nextSpeaker: () => void
  /** 开始投票 */
  beginVoting: () => void
  /** 选择投票目标 */
  selectVoteTarget: (targetId: number | null) => void
  /** 提交投票 */
  submitVote: (targetId: number) => void
  /** 处理投票结果 */
  resolveVote: () => void
  /** 揭晓全部结果 */
  doRevealAll: () => void
  /** 继续游戏（投票后未结束） */
  continuePlaying: () => void
  /** 重置游戏 */
  reset: () => void
}

/**
 * 游戏核心逻辑 Hook
 * 封装 store 操作 + 业务规则校验
 */
export function useGameLogic(): UseGameLogicReturn {
  const store = useGameStore()

  const startNewGame = useCallback(
    (config?: Partial<GameConfig>) => {
      if (config) {
        store.setConfig(config)
      }

      const currentConfig = useGameStore.getState().config

      // 使用统一发牌入口（与 DealingScreen 共享）
      const { players, wordPair } = executeDeal({
        playerCount: currentConfig.playerCount,
        spyCount: currentConfig.spyCount,
        blankCount: currentConfig.blankCount,
        difficulty: currentConfig.difficulty,
      })

      store.startGame()
      store.dealCards(players)
      // 保存选中的词对（内部方式）
      useGameStore.setState({ selectedPair: wordPair })
    },
    [store]
  )

  const revealCurrentCard = useCallback(() => {
    const { players, currentPlayerIndex } = useGameStore.getState()
    const currentPlayer = players[currentPlayerIndex]
    if (currentPlayer) {
      store.revealOwnCard(currentPlayer.id)
    }
  }, [store])

  const goToNextPlayer = useCallback(() => {
    const { players, currentPlayerIndex } = useGameStore.getState()
    if (currentPlayerIndex < players.length - 1) {
      useGameStore.setState({ currentPlayerIndex: currentPlayerIndex + 1 })
    }
  }, [])

  const goToPrevPlayer = useCallback(() => {
    const { currentPlayerIndex } = useGameStore.getState()
    if (currentPlayerIndex > 0) {
      useGameStore.setState({ currentPlayerIndex: currentPlayerIndex - 1 })
    }
  }, [])

  const finishDealingPhase = useCallback(() => {
    store.finishDealing()
  }, [store])

  const nextSpeaker = useCallback(() => {
    store.nextSpeaker()
  }, [store])

  const beginVoting = useCallback(() => {
    store.startVoting()
  }, [store])

  const selectVoteTarget = useCallback(
    (targetId: number | null) => {
      store.setVotingTarget(targetId)
    },
    [store]
  )

  const submitVote = useCallback(
    (targetId: number) => {
      // 当前操作者投给 targetId（简化：直接记录投票）
      store.castVote(targetId)
    },
    [store]
  )

  const resolveVote = useCallback(() => {
    store.processVoteResult()
  }, [store])

  const doRevealAll = useCallback(() => {
    store.revealAll()
  }, [store])

  const continuePlaying = useCallback(() => {
    store.continueGame()
  }, [store])

  const reset = useCallback(() => {
    store.resetGame()
  }, [store])

  return {
    startNewGame,
    revealCurrentCard,
    goToNextPlayer,
    goToPrevPlayer,
    finishDealingPhase,
    nextSpeaker,
    beginVoting,
    selectVoteTarget,
    submitVote,
    resolveVote,
    doRevealAll,
    continuePlaying,
    reset,
  }
}
