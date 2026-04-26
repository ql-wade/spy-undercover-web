import { create } from 'zustand'
import type { GamePhase, GameConfig, Player, WordPair, Role } from '../types/game'

// ========== 默认配置 ==========

const DEFAULT_CONFIG: GameConfig = {
  playerCount: 6,
  spyCount: 1,
  blankCount: 0,
  gameMode: 'classic',
  difficulty: 'random',
  descriptionRounds: 1,
  timerEnabled: false,
  timerSeconds: 30,
}

// ========== Store 状态接口 ==========

interface GameStore {
  // --- 核心状态 ---
  phase: GamePhase
  config: GameConfig
  selectedPair: WordPair | null
  players: Player[]

  // --- 流程状态 ---
  currentPlayerIndex: number
  currentSpeakerIndex: number
  currentRound: number
  votingTarget: number | null
  winner: 'civilian' | 'spy' | 'blank' | null
  eliminatedOrder: number[]
  voteResults: Record<number, number>

  // --- 配置操作 ---
  setConfig: (config: Partial<GameConfig>) => void

  // --- 流程控制 ---
  startGame: () => void              // idle/setup → dealing
  dealCards: (players: Player[]) => void
  revealOwnCard: (playerId: number) => void
  finishDealing: () => void          // dealing → playing
  nextSpeaker: () => void
  startVoting: () => void            // playing → voting
  setVotingTarget: (targetId: number | null) => void
  castVote: (targetId: number) => void  // 单设备模式：voterId 由当前操作者隐式确定
  processVoteResult: () => void      // voting → reveal（或继续游戏）
  revealAll: () => void
  continueGame: () => void           // voteResult → playing
  resetGame: () => void              // → idle
}

// ========== 辅助函数：创建玩家数组 ==========

function createPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `玩家 ${i + 1}`,
    word: null,
    role: 'civilian' as Role,
    isAlive: true,
    isRevealed: false,
    votes: 0,
  }))
}

// ========== 判定胜负（纯函数，可导出供测试）==========

/**
 * 判定胜负（§9.3 游戏结束判定）
 *
 * 规则：
 * 1. 卧底全部淘汰 → 平民胜
 * 2. 平民(+白板) 数 ≤ 卧底数 → 卧底胜
 * 3. 只剩白板 → 白板胜
 */
export function determineWinner(players: Player[]): 'civilian' | 'spy' | 'blank' | null {
  const alive = players.filter((p) => p.isAlive)
  const aliveSpies = alive.filter((p) => p.role === 'spy')
  const aliveCivilians = alive.filter((p) => p.role === 'civilian')
  const aliveBlanks = alive.filter((p) => p.role === 'blank')

  // 卧底全部淘汰 → 平民胜
  if (aliveSpies.length === 0 && aliveCivilians.length > 0) {
    return 'civilian'
  }

  // 平民数 ≤ 卧底数 → 卧底胜
  if (aliveCivilians.length > 0 && aliveCivilians.length <= aliveSpies.length) {
    return 'spy'
  }

  // 只剩白板 → 白板胜
  if (aliveBlanks.length > 0 && aliveCivilians.length === 0 && aliveSpies.length === 0) {
    return 'blank'
  }

  return null
}

// ========== Zustand Store ==========

export const useGameStore = create<GameStore>((set, get) => ({
  // --- 初始状态 ---
  phase: 'idle',
  config: { ...DEFAULT_CONFIG },
  selectedPair: null,
  players: [],
  currentPlayerIndex: 0,
  currentSpeakerIndex: 0,
  currentRound: 1,
  votingTarget: null,
  winner: null,
  eliminatedOrder: [],
  voteResults: {},

  // --- 配置操作 ---
  setConfig: (partial) =>
    set((state) => ({
      config: { ...state.config, ...partial },
    })),

  // --- 开始游戏 ---
  startGame: () => {
    const { config } = get()
    set({
      phase: 'dealing',
      players: createPlayers(config.playerCount),
      currentPlayerIndex: 0,
      currentSpeakerIndex: 0,
      currentRound: 1,
      votingTarget: null,
      winner: null,
      eliminatedOrder: [],
      voteResults: {},
    })
  },

  // --- 发牌结果写入 ---
  dealCards: (players) => {
    set({
      players,
      phase: 'dealing',
      currentPlayerIndex: 0,
    })
  },

  // --- 查看自己的牌 ---
  revealOwnCard: (playerId) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, isRevealed: true } : p
      ),
    })),

  // --- 发牌完成，进入描述阶段 ---
  finishDealing: () => {
    const phase = get().phase
    if (phase !== 'dealing') {
      console.warn('[store] 非法转换: finishDealing 要求 phase=dealing', { phase })
      return
    }
    set({ phase: 'playing', currentSpeakerIndex: 0, currentRound: 1 })
  },

  // --- 下一位发言者 ---
  nextSpeaker: () => {
    const { players, currentSpeakerIndex, currentRound, config } = get()
    const alivePlayers = players.filter((p) => p.isAlive)

    // 🔒 边界保护：淘汰玩家后 alivePlayers 缩小，确保索引不越界
    const safeIndex = Math.min(currentSpeakerIndex, Math.max(alivePlayers.length - 1, 0))
    const nextIdx = safeIndex + 1

    if (nextIdx >= alivePlayers.length) {
      // 本轮结束
      if (currentRound >= config.descriptionRounds) {
        // 所有轮次完成，进入投票
        set({ phase: 'voting', voteResults: {}, votingTarget: null })
      } else {
        // 进入下一轮
        set({ currentSpeakerIndex: 0, currentRound: currentRound + 1 })
      }
    } else {
      set({ currentSpeakerIndex: nextIdx })
    }
  },

  // --- 开始投票 ---
  startVoting: () => {
    const phase = get().phase
    if (phase !== 'playing') {
      console.warn('[store] 非法转换: startVoting 要求 phase=playing', { phase })
      return
    }
    set({ phase: 'voting', voteResults: {}, votingTarget: null })
  },

  // --- 设置投票目标 ---
  setVotingTarget: (targetId) => {
    set({ votingTarget: targetId })
  },

  // --- 投票 ---
  // 单设备模式下 voterId 不需要区分（轮流操作），签名仅保留 targetId
  castVote: (targetId: number) => {
    set((state) => ({
      voteResults: {
        ...state.voteResults,
        [targetId]: (state.voteResults[targetId] || 0) + 1,
      },
    }))
  },

  // --- 处理投票结果 ---
  processVoteResult: () => {
    const { voteResults, players } = get()

    // 找出得票最多的玩家
    let maxVotes = 0
    let eliminatedId: number | null = null
    let tie = false

    for (const [pid, votes] of Object.entries(voteResults)) {
      const id = Number(pid)
      if (votes > maxVotes) {
        maxVotes = votes
        eliminatedId = id
        tie = false
      } else if (votes === maxVotes && maxVotes > 0) {
        tie = true
      }
    }

    if (eliminatedId !== null && !tie) {
      // 淘汰该玩家
      const newPlayers = players.map((p) =>
        p.id === eliminatedId ? { ...p, isAlive: false, votes: 0 } : { ...p, votes: 0 }
      )
      const winner = determineWinner(newPlayers)

      if (winner) {
        // 游戏结束 → 直接进入揭晓
        set((state) => ({
          players: newPlayers,
          eliminatedOrder: [...state.eliminatedOrder, eliminatedId],
          winner,
          phase: 'reveal',
          voteResults: {},
          votingTarget: null,
        }))
      } else {
        // 有人被淘汰但游戏未结束 → 显示投票结果（voteResult 阶段）
        set((state) => ({
          players: newPlayers,
          eliminatedOrder: [...state.eliminatedOrder, eliminatedId],
          winner: null,
          phase: 'voteResult',
          voteResults: {},
          votingTarget: null,
        }))
      }
    } else {
      // 平局：不淘汰，继续游戏
      set({
        phase: 'playing',
        currentSpeakerIndex: 0,
        currentRound: 1,
        voteResults: {},
        votingTarget: null,
      })
    }
  },

  // --- 揭晓全部 ---
  revealAll: () => {
    const { players } = get()
    const revealedPlayers = players.map((p) => ({ ...p, isRevealed: true }))
    const winner = determineWinner(revealedPlayers)

    set({
      phase: 'reveal',
      players: revealedPlayers,
      winner: winner ?? get().winner,
    })
  },

  // --- 继续游戏（投票后未结束）---
  continueGame: () => {
    set(() => ({
      phase: 'playing',
      currentSpeakerIndex: 0,
      currentRound: 1,
      voteResults: {},
      votingTarget: null,
    }))
  },

  // --- 重置游戏 ---
  resetGame: () => {
    set({
      phase: 'idle',
      config: { ...DEFAULT_CONFIG },
      selectedPair: null,
      players: [],
      currentPlayerIndex: 0,
      currentSpeakerIndex: 0,
      currentRound: 1,
      votingTarget: null,
      winner: null,
      eliminatedOrder: [],
      voteResults: {},
    })
  },
}))

// ========== 预构建选择器（§8.1 性能优化）==========
/**
 * 细粒度选择器：组件仅订阅需要的状态片段，避免无关更新触发重渲染
 *
 * 用法：
 * ```tsx
 * // ❌ 不好：任何状态变化都触发重渲染
 * const store = useGameStore()
 *
 * // ✅ 好：仅在 phase 变化时重渲染
 * const phase = useGameStore(s => s.phase)
 * ```
 */

/** 获取当前玩家对象（发牌阶段用） */
export function selectCurrentPlayer(state: GameStore): Player | undefined {
  return state.players[state.currentPlayerIndex]
}

/** 获取存活玩家列表（描述/投票阶段用） */
export function selectAlivePlayers(state: GameStore): Player[] {
  return state.players.filter((p) => p.isAlive)
}

/** 获取已查看牌的玩家数量 */
export function selectRevealedCount(state: GameStore): number {
  return state.players.filter((p) => p.isRevealed).length
}
