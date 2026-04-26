// ========== 词库类型 ==========

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface WordPair {
  id: string
  wordA: string // 平民词语
  wordB: string // 卧底词语
  category: string
  difficulty: Difficulty
}

// ========== 游戏角色 ==========

export type Role = 'civilian' | 'spy' | 'blank'

// ========== 玩家 ==========

export interface Player {
  id: number           // 1-based 编号
  name: string         // 显示名 "玩家 N"
  word: string | null  // 平民/卧底有词，白板为 null
  role: Role
  isAlive: boolean     // 是否存活（投票淘汰）
  isRevealed: boolean  // 是否已翻牌查看（发牌阶段）
  votes: number        // 当前轮得票数
}

// ========== 游戏阶段 ==========

export type GamePhase = 'idle' | 'setup' | 'dealing' | 'playing' | 'voting' | 'voteResult' | 'reveal'

// ========== 游戏模式 ==========

export type GameMode = 'classic' | 'whiteboard'

// ========== 游戏配置 ==========

export interface GameConfig {
  playerCount: number      // 4-12
  spyCount: number         // 1-2
  blankCount: number       // 0-2
  gameMode: GameMode
  difficulty: Difficulty | 'random'
  descriptionRounds: number // 1-3
  timerEnabled: boolean
  timerSeconds: number     // 默认 30
}

// ========== 游戏状态 ==========

export interface GameState {
  phase: GamePhase
  config: GameConfig
  selectedPair: WordPair | null
  players: Player[]
  currentPlayerIndex: number   // 发牌阶段当前查看的玩家索引
  currentSpeakerIndex: number  // 描述阶段当前发言者索引
  currentRound: number         // 当前描述轮次 (1-based)
  votingTarget: number | null  // 投票阶段选中的目标玩家 id
  winner: 'civilian' | 'spy' | 'blank' | null
  eliminatedOrder: number[]    // 淘汰顺序（玩家 id 列表）
  voteResults: Record<number, number> // 玩家id → 得票数
}

// ========== 投票结果 ==========

export interface VoteResult {
  playerId: number
  voteCount: number
  eliminated: boolean
}

// ========== API 响应类型 ==========

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export interface WordsResponse {
  words: WordPair[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  meta?: {
    lastUpdated: string
    checksum: string
  }
}

export interface RandomWordsResponse {
  words: WordPair[]
  count: number
}

export interface TodayWordsResponse {
  date: string
  words: WordPair[]
  count: number
}
