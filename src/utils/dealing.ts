import type { Player, WordPair, Role } from '../types/game'
import { getRandomWordPair } from '../data/builtin-words'

/**
 * Fisher-Yates 洗牌算法
 */
function shuffle<T>(array: readonly T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!] as [T, T]
  }
  return arr
}

/**
 * 发牌算法（§9.1）
 *
 * 规则：
 * - N 个玩家，S 个卧底，B 个白板
 * - 平民数 = N - S - B（必须 ≥ S + B，保证平民占优）
 * - 最少 4 人（3平民 + 1卧底）
 * - 当 N ≤ 5 时，最多 1 个卧底
 * - 白板数量上限 = floor((N - S - 1) / 2)
 *
 * @param playerCount 总人数 (4-12)
 * @param spyCount 卧底数 (1-2)
 * @param blankCount 白板数 (0-2)
 * @param wordPair 选中的词对
 * @returns 分配好角色和词语的玩家数组
 */
export function dealCards(
  playerCount: number,
  spyCount: number,
  blankCount: number,
  wordPair: WordPair
): Player[] {
  const civilianCount = playerCount - spyCount - blankCount

  // 参数校验
  if (playerCount < 4 || playerCount > 12) {
    throw new RangeError(`玩家人数必须在 4-12 之间，当前: ${playerCount}`)
  }
  if (spyCount < 1 || spyCount > 2) {
    throw new RangeError(`卧底数量必须在 1-2 之间，当前: ${spyCount}`)
  }
  if (blankCount < 0 || blankCount > 2) {
    throw new RangeError(`白板数量必须在 0-2 之间，当前: ${blankCount}`)
  }
  if (civilianCount < 1) {
    throw new RangeError('平民数量不足，请减少卧底或白板数量')
  }
  if (playerCount <= 5 && spyCount > 1) {
    throw new RangeError('5人及以下最多只能有1个卧底')
  }

  // 构建角色数组
  const roles: Role[] = [
    ...Array(civilianCount).fill('civilian' as Role),
    ...Array(spyCount).fill('spy' as Role),
    ...Array(blankCount).fill('blank' as Role),
  ]

  // 随机打乱角色顺序
  const shuffledRoles = shuffle(roles)

  // 构建玩家数组
  const players: Player[] = shuffledRoles.map((role, index) => ({
    id: index + 1,
    name: `玩家 ${index + 1}`,
    word: role === 'blank' ? null : role === 'spy' ? wordPair.wordB : wordPair.wordA,
    role,
    isAlive: true,
    isRevealed: false,
    votes: 0,
  }))

  return players
}

/**
 * 执行完整发牌流程（统一入口，消除 DRY 违规）
 *
 * 封装：随机选词 → 发牌算法 → 写入 store
 * 供 useGameLogic.startNewGame 和 DealingScreen 共用
 */
export function executeDeal(config: {
  playerCount: number
  spyCount: number
  blankCount: number
  difficulty?: 'easy' | 'medium' | 'hard' | 'random'
}): { players: Player[]; wordPair: WordPair } {
  const wordPair = getRandomWordPair(config.difficulty)
  const players = dealCards(
    config.playerCount,
    config.spyCount,
    config.blankCount,
    wordPair
  )
  return { players, wordPair }
}
