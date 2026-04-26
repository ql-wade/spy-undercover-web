# 谁是卧底 Web 版 — 系统架构设计文档

> **项目**：spy-undercover | **版本**：v1.0 | **状态**：已审批 | **日期**：2026-04-26
> **基于**：调研报告 v2.0 + PRD v1.0 + 原型设计 v1.0
> **架构师**：Architect 🏗️

---

## 目录

1. [整体系统架构](#1-整体系统架构)
2. [前端架构](#2-前端架构)
3. [后端架构（CF Workers）](#3-后端架构cf-workers)
4. [爬虫模块设计](#4-爬虫模块设计)
5. [数据模型](#5-数据模型)
6. [词库保护策略](#6-词库保护策略)
7. [部署方案](#7-部署方案)
8. [性能与安全](#8-性能与安全)
9. [关键业务逻辑](#9-关键业务逻辑)

---

## 1. 整体系统架构

### 1.1 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户设备 (Browser)                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    React SPA (前端)                          │   │
│  │                                                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │ 首页/设置 │ │ 发牌引擎  │ │ 游戏流程  │ │ 揭晓结果     │   │   │
│  │  │ /setup   │ │ /dealing │ │ /playing  │ │ /reveal      │   │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │   │
│  │       │            │           │              │           │   │
│  │  ┌────▼────────────▼───────────▼──────────────▼───────┐    │   │
│  │  │              Zustand Store (游戏状态机)             │    │   │
│  │  │  setup → dealing → playing → voting → reveal       │    │   │
│  │  └───────────────────────────────────────────────────┘    │   │
│  │                                                             │   │
│  │  ┌────────────────────────────────────────────────────┐    │   │
│  │  │          词库层 (内置 fallback + API 拉取)          │    │   │
│  │  │  ┌──────────────┐     ┌────────────────────────┐   │    │   │
│  │  │  │ 内置 200+ 词对│     │ wordApi.ts (fetch API) │   │    │   │
│  │  │  │ (静态 import) │◄───►│ 缓存到 localStorage   │   │    │   │
│  │  │  └──────────────┘     └──────────┬─────────────┘   │    │   │
│  │  └─────────────────────────────────┼──────────────────┘    │   │
│  └────────────────────────────────────┼───────────────────────┘   │
│                                       │                           │
│  ┌────────────────────────────────────▼───────────────────────┐   │
│  │                    Service Worker (v1.1 PWA)                │   │
│  │              离线缓存: 静态资源 + 内置词库                   │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                                       │
                                   HTTPS (REST)
                                       │
┌──────────────────────────────────────┼──────────────────────────────┐
│                         Cloudflare Edge                           │
│                                      │                             │
│  ┌───────────────────────────────────▼──────────────────────────┐ │
│  │                     Cloudflare Workers                        │ │
│  │                                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │                  API Router (Hono)                       │  │ │
│  │  │                                                         │  │ │
│  │  │  GET  /api/words        → 词库查询 (分页/筛选)         │  │ │
│  │  │  GET  /api/words/random → 随机获取 N 对                 │  │ │
│  │  │  GET  /api/words/today  → 今日新词                     │  │ │
│  │  │  GET  /api/health       → 健康检查                      │  │ │
│  │  │  POST /api/admin/refresh→ 手动触发刷新 (密钥认证)       │  │ │
│  │  └──────────┬──────────────────────────────────────────────┘  │ │
│  │             │                                                   │ │
│  │  ┌──────────▼──────────────────────────────────────────────┐  │ │
│  │  │               Middleware Layer                          │  │ │
│  │  │  • CORS (允许前端域名)                                  │  │ │
│  │  │  • Rate Limiter (60 req/min per IP, sliding window)    │  │ │
│  │  │  • Request Logger + Error Handler                      │  │ │
│  │  └──────────┬──────────────────────────────────────────────┘  │ │
│  │             │                                                   │ │
│  │  ┌──────────▼──────────────────┐  ┌────────────────────────┐  │ │
│  │  │     Word Service            │  │   Crawler Service       │  │ │
│  │  │  • 词库读取/过滤/分页       │  │  • 多源爬取调度         │  │ │
│  │  │  • 难度/主题筛选            │  │  • 词条清洗+配对        │  │ │
│  │  │  • 随机选取算法             │  │  • 敏感词过滤           │  │ │
│  │  │  • 增量更新检测             │  │  • KV 入库              │  │ │
│  │  └──────────┬──────────────────┘  └──────────┬─────────────┘  │ │
│  │             │                                │                │ │
│  └─────────────┼────────────────────────────────┼────────────────┘ │
│                │                                │                  │
│  ┌─────────────▼──────────┐  ┌─────────────────▼──────────────┐  │
│  │   Cloudflare KV         │  │   Cron Trigger (每日 06:00    │  │
│  │                         │  │   UTC+8 = 22:00 UTC 前日)     │  │
│  │  Key: "words:v1"        │  │                                 │  │
│  │  Key: "words:meta"      │  │  触发 Crawler Service 执行     │  │
│  │  Key: "words:today"     │  │  完整爬取→清洗→配对→入库流程  │  │
│  │  Key: "ratelimit:{ip}"  │  │                                 │  │
│  │  TTL: 30d (词库数据)     │  │  超时限制: CPU 30s (Paid)     │  │
│  │  TTL: 60s (限流计数器)   │  │  或拆分为多步 Subrequest      │  │
│  └─────────────────────────┘  └─────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Cloudflare R2 (可选)                       │  │
│  │              大容量词库 JSON 文件存储                          │  │
│  │              当 KV 单值 25MB 不足时启用                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流全景

```
                    ┌──────────────┐
                    │  定时触发     │
                    │  Cron Daily  │
                    └──────┬───────┘
                           │ 触发
                           ▼
              ┌────────────────────────┐
              │    Source 1: GitHub     │ ◄─── 最高优先级
              │    开源词库仓库          │     MIT 协议
              │    (raw JSON/API)       │
              └──────────┬─────────────┘
                         │
              ┌──────────▼─────────────┐
              │    Source 2: 公开网页   │
              │    热搜/热词聚合页       │     中优先级
              │    (fetch + 正则提取)   │
              └──────────┬─────────────┘
                         │
              ┌──────────▼─────────────┐
              │    Source 3: 备用源     │
              │    其他公开词库页面      │     降级兜底
              └──────────┬─────────────┘
                         │
                         ▼
              ┌────────────────────────┐
              │    统一清洗管道          │
              │  1. 去重 (by wordA+wordB)│
              │  2. 格式标准化           │
              │  3. 词条配对算法         │
              │  4. 敏感词过滤           │
              │  5. 难度自动标注         │
              └──────────┬─────────────┘
                         │ 写入
                         ▼
              ┌────────────────────────┐
              │    Cloudflare KV        │
              │  words:v1 (全量 JSON)    │
              │  words:meta (元信息)     │
              │  words:today (当日新词)  │
              └──────────┬─────────────┘
                         │ 读取
                         ▼
              ┌────────────────────────┐
              │    CF Workers API       │
              │  GET /api/words/*       │
              │  (带缓存 + 限流)        │
              └──────────┬─────────────┘
                         │ HTTP JSON
                         ▼
              ┌────────────────────────┐
              │    React SPA 前端       │
              │  wordApi.ts → Zustand   │
              │  → 内置词库 merge       │
              │  → localStorage 缓存    │
              └────────────────────────┘
```

### 1.3 架构决策记录

| # | 决策 | 理由 |
|---|------|------|
| ADR-001 | 前后端分离 | 前端可独立运行（内置词库 fallback），后端仅提供增量价值（在线词库） |
| ADR-002 | CF Workers serverless | 免费额度覆盖 MVP；零运维；全球边缘节点低延迟 |
| ADR-003 | Hono 作为 Worker 框架 | 轻量（< 14KB）、TypeScript 原生支持、边缘兼容、中间件生态好 |
| ADR-004 | KV 为主存储 | 免费额度够用；低延迟读取；Cron 写入频率极低（1次/日） |
| ADR-005 | 状态机路由替代 React Router | 游戏是线性流程（setup→dealing→play→vote→reveal），不需要 URL 路由的复杂性 |
| ADR-006 | 内置词库作为必选 fallback | 聚会场景不能因网络问题无法使用；离线优先策略 |

---

## 2. 前端架构

### 2.1 技术栈确认

| 层 | 技术 | 版本 | 选型理由 |
|----|------|------|----------|
| UI 框架 | React | 18.3 | 并发特性、Suspense 边界、生态成熟；19 尚在早期避免引入 |
| 构建工具 | Vite | 6.x | 原生 ESM、极速 HMR、Rollup 打包；6 稳定版生态工具链完整 |
| 语言 | TypeScript | 5.5+ | 全量类型安全；编译时错误捕获 |
| 样式 | TailwindCSS | 4.x | CSS-first 配置、OXIDE 引擎性能提升、暗色主题原生支持 |
| 动画 | Framer Motion | 11+ | React 声明式动画、layout animations、手势支持、GPU 加速 |
| 状态管理 | Zustand | 4.5+ | 极简 API（~1KB）、无 boilerplate、TypeScript 推断优秀 |
| 路由 | 状态机驱动（无 React Router） | — | 游戏是线性有限状态机，URL 路由增加不必要的复杂度；见 2.5 |
| 图标 | Iconify (lucide) | — | 按需加载、4000+ 图标、tree-shakable |
| PWA | vite-plugin-pwa | — | Workbox 集成、自动生成 manifest（v1.1 启用） |
| 代码质量 | Biome | — | 替代 ESLint+Prettier，单工具链，Rust 编写速度快 |

### 2.2 目录结构

```
spy-undercover/
├── public/
│   ├── favicon.svg
│   ├── og-image.png                    # Open Graph 分享图
│   └── robots.txt
├── src/
│   ├── main.tsx                        # 应用入口
│   ├── App.tsx                         # 根组件（状态机分发）
│   ├── index.css                       # TailwindCSS 导入 + 全局样式
│   ├── vite-env.d.ts
│   │
│   ├── types/                          # TypeScript 类型定义
│   │   ├── game.ts                     # 游戏/玩家/配置类型
│   │   ├── words.ts                    # 词库/词对类型
│   │   └── api.ts                      # API 请求/响应类型
│   │
│   ├── stores/                         # Zustand 状态管理
│   │   ├── gameStore.ts                # 游戏主状态机
│   │   └── settingsStore.ts            # 用户偏好设置
│   │
│   ├── hooks/                          # 自定义 Hooks
│   │   ├── useGame.ts                  # 游戏操作封装（发牌/投票/淘汰）
│   │   ├── useWordBank.ts              # 词库加载（内置→API→缓存）
│   │   ├── useAntiPeek.ts              # 防偷看逻辑（blur/显示/重模糊）
│   │   ├── useTimer.ts                 # 计时器 Hook
│   │   └── useMediaQuery.ts            # 响应式断点检测
│   │
│   ├── services/                       # 服务层
│   │   ├── wordApi.ts                  # CF Workers API 客户端
│   │   ├── storage.ts                  # localStorage 封装
│   │   └── dealer.ts                   # 发牌算法纯函数
│   │
│   ├── data/                           # 静态数据
│   │   └── builtin-words.ts            # 200+ 内置词对（编译时打包）
│   │
│   ├── components/                     # 组件目录
│   │   ├── screens/                    # 页面级组件（= 状态机状态）
│   │   │   ├── HomeScreen.tsx          # 首页
│   │   │   ├── SetupScreen.tsx         # 设置页
│   │   │   ├── DealingScreen.tsx       # 发牌页（翻牌交互）
│   │   │   ├── PlayingScreen.tsx       # 游戏进行页（描述阶段）
│   │   │   ├── VotingScreen.tsx        # 投票页
│   │   │   ├── VoteResultScreen.tsx    # 投票结果页
│   │   │   └── RevealScreen.tsx        # 揭晓页
│   │   │
│   │   ├── game/                       # 游戏核心组件
│   │   │   ├── CardDealer.tsx          # 发牌器容器（管理多张卡片）
│   │   │   ├── WordCard.tsx            # 单张翻牌卡片（3D翻转）
│   │   │   ├── PlayerGrid.tsx          # 玩家网格（投票用）
│   │   │   ├── RoleBadge.tsx           # 角色标签（平民/卧底/白板）
│   │   │   ├── VoteBar.tsx             # 投票进度条
│   │   │   └── GameHeader.tsx          # 游戏顶栏（返回/重新发牌）
│   │   │
│   │   ├── layout/                     # 布局组件
│   │   │   ├── ScreenLayout.tsx        # 统一屏幕容器（max-width居中）
│   │   │   ├── AppHeader.tsx           # 应用头部
│   │   │   └── Footer.tsx              # 底部信息
│   │   │
│   │   └── ui/                         # 通用 UI 组件
│   │       ├── Button.tsx              # 按钮（多变体）
│   │       ├── Stepper.tsx             # 数字步进器（人数/卧底数等）
│   │       ├── SegmentedControl.tsx    # 分段控制器（模式/难度切换）
│   │       ├── Toggle.tsx              # 开关（计时器等）
│   │       ├── Modal.tsx               # 模态框
│   │       ├── Toast.tsx               # 轻提示
│   │       ├── ProgressDots.tsx        # 进度点阵（发牌进度）
│   │       └── Countdown.tsx           # 倒计时组件
│   │
│   ├── utils/                          # 工具函数
│   │   ├── shuffle.ts                  # Fisher-Yates 洗牌
│   │   ├── cn.ts                       # className 合并（clsx + twMerge）
│   │   ├── id.ts                       # UUID 生成
│   │   └── constants.ts                # 游戏常量（约束/默认值）
│   │
│   └── styles/                         # 样式文件
│       └── theme.css                   # 自定义 CSS 变量（Tailwind 扩展）
│
├── index.html
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
├── package.json
├── biome.json                         # 代码风格配置
└── README.md
```

### 2.3 组件层级

```
App (状态机分发器)
│
├── ScreenLayout (统一布局容器: max-width: 430px 居中, 全屏高度)
│   │
│   ├── HomeScreen (首页)
│   │   ├── AppHeader (Logo + 标题)
│   │   ├── Button (CTA: 快速开始)
│   │   ├── Button (次级: 自定义设置)
│   │   ├── Button (次级: 白板模式)
│   │   └── Footer (词库信息)
│   │
│   ├── SetupScreen (设置页)
│   │   ├── GameHeader (返回按钮 + 标题)
│   │   ├── SegmentedControl (模式切换: 经典/白板)
│   │   ├── Stepper (玩家人数 4-12)
│   │   ├── Stepper (卧底数量 1-2)
│   │   ├── Stepper (白板数量 0-2)
│   │   ├── SegmentedControl (难度选择)
│   │   ├── Stepper (描述轮次 1-3)
│   │   ├── Toggle (计时器开关)
│   │   ├── RoleBadge (角色预览行)
│   │   └── Button (CTA: 开始发牌)
│   │
│   ├── DealingScreen (发牌页)
│   │   ├── GameHeader (重新发牌 + 玩家指示器)
│   │   ├── ProgressDots (查看进度)
│   │   ├── WordCard (翻牌卡片 - 核心)
│   │   │   └── RoleBadge (角色标签 + 词语)
│   │   └── Button (上一位/下一位导航)
│   │
│   ├── PlayingScreen (游戏进行页)
│   │   ├── Badge (轮次标识)
│   │   ├── Countdown (计时器)
│   │   └── Button (下一位发言 / 开始投票)
│   │
│   ├── VotingScreen (投票页)
│   │   ├── PlayerGrid (存活玩家网格)
│   │   │   └── VoteBar (单个玩家的投票卡片)
│   │   └── Button (确认投票)
│   │
│   ├── VoteResultScreen (投票结果页)
│   │   ├── VoteBar (所有玩家票数进度条)
│   │   └── Button (继续游戏 / 查看结果)
│   │
│   └── RevealScreen (揭晓页)
│       ├── RoleBadge (胜方标题)
│       ├── PlayerGrid (全部身份卡片 + 动画)
│       └── Button (再来一局 / 返回首页)
```

### 2.4 状态管理方案

#### Zustand Store 设计

```typescript
// stores/gameStore.ts

// ========== 类型定义 ==========

type GamePhase = 'idle' | 'setup' | 'dealing' | 'playing' | 'voting' | 'voteResult' | 'reveal';
type GameMode = 'classic' | 'whiteboard';
type Difficulty = 'random' | 'easy' | 'medium' | 'hard';
type Role = 'civilian' | 'spy' | 'blank';

interface Player {
  id: number;                // 1-based 玩家编号
  name: string;              // 显示名 "玩家 N"
  word: string | null;       // 平民/卧底有词, 白板为 null
  role: Role;                // 角色
  isAlive: boolean;          // 是否存活
  isRevealed: boolean;       // 是否已翻牌查看（发牌阶段）
  votes: number;             // 当前轮得票数
}

interface GameConfig {
  totalPlayers: number;      // 4-12
  spyCount: number;          // 1-2
  blankCount: number;        // 0-2
  mode: GameMode;
  difficulty: Difficulty;
  descriptionRounds: number; // 1-3
  timerEnabled: boolean;
  timerSeconds: number;      // 默认 30
}

interface GameState {
  // === 游戏阶段（核心状态机）===
  phase: GamePhase;

  // === 配置 ===
  config: GameConfig;

  // === 选中的词对 ===
  selectedPair: WordPair | null;

  // === 玩家列表 ===
  players: Player[];

  // === 流程状态 ===
  currentPlayerIndex: number;   // 发牌阶段: 当前查看的玩家索引
  currentSpeakerIndex: number;  // 描述阶段: 当前发言者索引
  currentRound: number;         // 当前描述轮次 (1-based)
  votingTarget: number | null;  // 投票阶段: 当前操作者选中的目标

  // === 结果 ===
  winner: 'civilian' | 'spy' | null;
  eliminatedOrder: number[];    // 淘汰顺序（玩家 id 列表）
  voteResults: Record<number, number>; // 玩家id → 得票数（使用 Record 而非 Map，确保 JSON 序列化/持久化兼容）

  // === Actions ===
  // -- 配置 --
  setConfig: (config: Partial<GameConfig>) => void;

  // -- 流程控制 --
  startDealing: () => void;           // setup → dealing
  nextPlayer: () => void;             // 发牌: 下一位
  prevPlayer: () => void;             // 发牌: 上一位
  finishDealing: () => void;          // dealing → playing
  nextSpeaker: () => void;            // playing: 下一位发言
  startVoting: () => void;            // playing → voting
  castVote: (targetId: number) => void; // 投票
  processVoteResult: () => void;      // voting → voteResult
  continueGame: () => void;           // voteResult → playing (新回合)
  revealAll: () => void;              // voteResult/dealing → reveal
  resetGame: () => void;              // reveal → idle

  // -- 发牌操作 --
  revealCard: (playerId: number) => void;  // 翻开某张卡
  hideCard: (playerId: number) => void;     // 隐藏某张卡
  redeal: () => void;                      // 重新发牌
}
```

#### 状态机转换矩阵

```
         ┌────────────────────────────────────────────────────────────┐
         │                    Game Phase State Machine                │
         ├──────────┬──────────┬──────────┬──────────┬───────────────┤
         │  From \  │  setup   │ dealing  │ playing  │ voting /      │
         │   To     │          │          │          │ voteResult    │
         ├──────────┼──────────┼──────────┼──────────┼───────────────┤
         │ idle     │ ✅ 快速   │          │          │               │
         │          │ 开始/设置 │          │          │               │
         ├──────────┼──────────┼──────────┼──────────┼───────────────┤
         │ setup    │          │ ✅ 开始   │          │               │
         │          │          │ 发牌     │          │               │
         ├──────────┼──────────┼──────────┼──────────┼───────────────┤
         │ dealing  │          │          │ ✅ 全部  │               │
         │          │          │          │ 看完     │               │
         ├──────────┼──────────┼──────────┼──────────┼───────────────┤
         │ playing  │          │          │          │ ✅ 开始投票    │
         ├──────────┼──────────┼──────────┼──────────┼───────────────┤
         │ voting   │          │          │          │ ✅ 确认投票    │
         ├──────────┼──────────┼──────────┼──────────┼───────────────┤
         │voteResult│          │ ✅ 继续  │          │               │
         │          │          │ 游戏下一轮│         │ ✅ 游戏结束    │
         ├──────────┼──────────┼──────────┼──────────┼───────────────┤
         │ reveal   │ ✅ 再来  │ ✅ 再来  │          │               │
         │          │ 一局     │ 一局(跳过 │          │               │
         │          │          │ 描述)     │          │               │
         └──────────┴──────────┴──────────┴──────────┴───────────────┘

非法转换调用 → no-op + console.warn（不抛异常，保证健壮性）
```

#### Settings Store

```typescript
// stores/settingsStore.ts
interface SettingsState {
  theme: 'dark' | 'light' | 'system';     // 默认 dark（原型设计为深色主题）
  seenOnboarding: boolean;
  lastGameConfig: GameConfig | null;       // 记住上次配置

  setTheme: (theme: SettingsState['theme']) => void;
  markOnboardingSeen: () => void;
  saveLastConfig: (config: GameConfig) => void;
}
```

Settings Store 持久化到 `localStorage`（Zustand `persist` middleware）。

### 2.5 路由方案：状态机路由

**决策：不使用 React Router，使用状态机驱动的条件渲染。**

理由：
1. 游戏是**严格线性流程**（setup → dealing → play → vote → result），不存在任意跳转需求
2. 不需要 URL 深链接（聚会场景不会分享某个中间状态 URL）
3. 避免 router 的额外 bundle 体积（~3KB gzipped）
4. 状态和路由天然一一对应，`phase` 变量即路由

实现方式：

```tsx
// App.tsx — 状态机分发器
function App() {
  const phase = useGame((s) => s.phase);

  return (
    <ScreenLayout>
      {phase === 'idle' && <HomeScreen />}
      {phase === 'setup' && <SetupScreen />}
      {phase === 'dealing' && <DealingScreen />}
      {phase === 'playing' && <PlayingScreen />}
      {phase === 'voting' && <VotingScreen />}
      {phase === 'voteResult' && <VoteResultScreen />}
      {phase === 'reveal' && <RevealScreen />}
    </ScreenLayout>
  );
}
```

页面切换动画通过 Framer Motion `AnimatePresence` 实现：

```tsx
<AnimatePresence mode="wait">
  <motion.div key={phase} initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.3 }}>
    {/* 当前 Screen */}
  </motion.div>
</AnimatePresence>
```

> **v2.0 备注**：如果后续需要房间码/分享功能，可引入 `react-router-dom` 的 `MemoryHistory`（不影响 URL），或升级为 hash-based routing。

### 2.6 关键 Hooks 列表

| Hook | 文件 | 职责 | 返回值 |
|------|------|------|--------|
| `useGame()` | hooks/useGame.ts | 从 gameStore 提取常用操作 + 业务规则校验 | `{ deal, vote, eliminate, checkWinCondition }` |
| `useWordBank()` | hooks/useWordBank.ts | 词库加载策略：内存 → localStorage → 内置 → API | `{ words, isLoading, error, refresh }` |
| `useAntiPeek()` | hooks/useAntiPeek.ts | 防偷看状态管理：blur → click显示 → timeout → 重模糊 | `{ isBlurred, showWord, hideWord }` |
| `useTimer()` | hooks/useTimer.ts | 倒计时逻辑：start/pause/reset + 阈值警告 | `{ timeLeft, isRunning, isWarning, isCritical, start, pause, reset }` |
| `useMediaQuery()` | hooks/useMediaQuery.ts | 响应式断点监听 | `{ isMobile, isTablet, isDesktop }` |
| `usePreventLeave()` | hooks/usePreventLeave.ts | 游戏进行中阻止意外离开（beforeunload） | — |
| `useKeyboardNav()` | hooks/useKeyboardNav.ts | 键盘导航支持（Tab/Enter/Arrow） | — |

---

## 3. 后端架构（CF Workers）

### 3.1 Worker 代码结构

```
worker/
├── src/
│   ├── index.ts                  # Worker 入口 (Hono app)
│   ├── config.ts                 # 环境变量绑定类型定义
│   │
│   ├── middleware/
│   │   ├── cors.ts               # CORS 中间件
│   │   ├── rateLimit.ts          # 频率限制 (KV sliding window)
│   │   ├── errorHandler.ts       # 统一错误处理
│   │   └── logger.ts             # 请求日志
│   │
│   ├── routes/
│   │   ├── words.ts              # /api/words/* 路由组
│   │   ├── health.ts             # /api/health 路由
│   │   └── admin.ts              # /api/admin/* 路由（需认证）
│   │
│   ├── services/
│   │   ├── wordService.ts        # 词库读写服务 (KV 操作)
│   │   └── crawlerService.ts     # 爬虫调度服务
│   │
│   ├── crawler/
│   │   ├── index.ts              # 爬虫入口 (Cron Trigger 调用)
│   │   ├── sources/              # 各数据源适配器
│   │   │   ├── githubSource.ts   # GitHub 开源词库
│   │   │   ├── hotwordSource.ts  # 热搜/热词页面
│   │   │   └── fallbackSource.ts # 备用源
│   │   ├── pipeline.ts           # 清洗管道 (去重→配对→过滤→入库)
│   │   ├── matcher.ts            # 词条配对算法
│   │   └── filter.ts             # 敏感词过滤
│   │
│   ├── types/
│   │   └── worker.ts             # Worker 侧类型定义
│   │
│   └── utils/
│       ├── response.ts           # 统一响应格式化
│       └── crypto.ts             # checksum 计算
│
├── wrangler.toml                 # Workers 配置
├── wrangler.toml.dev             # 开发环境配置（可选 override）
├── package.json
└── tsconfig.json
```

### 3.2 API 路由设计

#### Hono 路由注册

```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from './middleware/cors.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { wordsRoutes } from './routes/words.js';
import { healthRoutes } from './routes/health.js';
import { adminRoutes } from './routes/admin.js';

const app = new Hono<{ Bindings: Env }>();

// 全局中间件
app.use('*', cors());
app.use('*', rateLimit({ windowMs: 60_000, maxRequests: 60 }));
app.use('*', logger());

// 路由
app.route('/api/health', healthRoutes);
app.route('/api/words', wordsRoutes);
app.route('/api/admin', adminRoutes);

// 404 处理
app.notFound((c) => c.json({ success: false, error: 'Not Found' }, 404));

// 全局错误处理
app.onError(errorHandler);

export default app;
```

#### 路由详细规格

##### GET /api/health

健康检查端点（无频率限制）。

**响应 200**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "timestamp": "2026-04-26T00:00:00Z",
    "uptime": 86400,
    "totalWords": 450
  }
}
```

---

##### GET /api/words

获取词库列表（支持分页、筛选）。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | number | 否 | `1` | 页码（从 1 开始） |
| `limit` | number | 否 | `50` | 每页数量，最大 `200` |
| `difficulty` | string | 否 | — | `easy` / `medium` / `hard` |
| `category` | string | 否 | — | 分类标签筛选 |
| `since` | string | 否 | — | ISO 8601 日期，增量更新（返回该日期后的新词） |

**响应 200**:
```json
{
  "success": true,
  "data": {
    "version": "1.2.0",
    "words": [
      {
        "id": "w301",
        "civilian_word": "奶茶",
        "spy_word": "咖啡",
        "category": "饮品",
        "difficulty": "easy",
        "source": "github-daily",
        "created_at": "2026-04-25T06:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 450,
      "totalPages": 9
    },
    "meta": {
      "lastUpdated": "2026-04-25T06:00:00Z",
      "checksum": "sha256:abc123..."
    }
  }
}
```

**错误响应**:
| 状态码 | body | 场景 |
|--------|------|------|
| 400 | `{ success: false, error: "Invalid difficulty", code: "INVALID_PARAM" }` | 参数非法 |
| 429 | `{ success: false, error: "Rate limit exceeded", code: "RATE_LIMITED", retryAfter: 60 }` | 超频 |

---

##### GET /api/words/random

随机获取 N 对词语（发牌时使用）。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `count` | number | 否 | `10` | 返回数量，最大 `50` |
| `difficulty` | string | 否 | — | 难度筛选 |
| `exclude` | string | 否 | — | 逗号分隔的已用词 ID（排除重复） |

**响应 200**:
```json
{
  "success": true,
  "data": {
    "words": [
      {
        "id": "w042",
        "civilian_word": "苹果",
        "spy_word": "梨子",
        "category": "水果",
        "difficulty": "easy",
        "source": "builtin",
        "created_at": "2026-01-01T00:00:00Z"
      }
    ],
    "count": 1
  }
}
```

**缓存策略**: CF Edge Cache 300s（随机结果按 query string 缓存，同一参数短时间返回相同结果可接受）。

---

##### GET /api/words/today

获取今日新增词对（用于首页展示"今日推荐"）。

**响应 200**:
```json
{
  "success": true,
  "data": {
    "date": "2026-04-26",
    "words": [...],
    "count": 5
  }
}
```

**缓存策略**: CF Edge Cache 3600s（每日更新一次，缓存 1 小时合理）。

---

#### API 错误响应规格总表

| 接口 | HTTP 状态码 | error code | 触发条件 | 响应示例 |
|------|-----------|------------|----------|----------|
| `GET /api/words` | 400 | `INVALID_PARAM` | page<1, limit>200, difficulty 非法值, category 非法值 | `{ success:false, error:"Invalid parameter", code:"INVALID_PARAM" }` |
| `GET /api/words` | 429 | `RATE_LIMITED` | 超过 60 req/min/IP | `{ success:false, error:"Rate limit exceeded", code:"RATE_LIMITED", retryAfter:60 }` |
| `GET /api/words/random` | 400 | `INVALID_PARAM` | count<1, count>50, difficulty 非法值 | `{ success:false, error:"Invalid count (1-50)", code:"INVALID_PARAM" }` |
| `GET /api/words/random` | 429 | `RATE_LIMITED` | 超过 60 req/min/IP | 同上 |
| `GET /api/words/today` | 404 | `NO_WORDS_TODAY` | 今日无新词（非致命错误，前端优雅降级到内置推荐） | `{ success:false, error:"No words for today", code:"NO_WORDS_TODAY" }` |
| `GET /api/words/today` | 429 | `RATE_LIMITED` | 超过独立限制 20 req/min/IP | `{ success:false, error:"Rate limit exceeded", code:"RATE_LIMITED", retryAfter:60 }` |
| `POST /api/admin/refresh` | 401 | `UNAUTHORIZED` | 缺少或无效 Bearer Token | `{ success:false, error:"Missing or invalid token", code:"UNAUTHORIZED" }` |
| `POST /api/admin/refresh` | 403 | `FORBIDDEN` | Token 过期或权限不足 | `{ success:false, error:"Token expired or insufficient permission", code:"FORBIDDEN" }` |
| `POST /api/admin/refresh` | 429 | `TOO_SOON` | 距上次手动刷新不足 1 小时 | `{ success:false, error:"Too soon, please try again later", code:"TOO_SOON", retryAfter:3600 }` |
| 任意接口 | 500 | `INTERNAL` | 服务端内部错误 | `{ success:false, error:"Internal server error", code:"INTERNAL", requestId:"abc123" }` |
| 任意接口 | 404 | `NOT_FOUND` | 路由不存在 | `{ success:false, error:"Not Found", code:"NOT_FOUND" }` |

---

##### POST /api/admin/refresh

手动触发词库刷新（管理员接口）。

**认证方式**: Bearer Token（`Authorization: Bearer <ADMIN_TOKEN>`）

**请求体** (可选):
```json
{ "force": true }
```

**响应 200**:
```json
{
  "success": true,
  "data": {
    "triggered": true,
    "message": "Crawler scheduled",
    "lastUpdated": "2026-04-26T00:00:00Z"
  }
}
```

**错误响应**:
| 状态码 | 场景 |
|--------|------|
| 401 | 缺少/无效 token |
| 403 | token 无权限 |
| 429 | 距上次刷新不足 1 小时（防滥用） |

---

### 3.3 中间件设计

#### CORS 配置

```typescript
// middleware/cors.ts
export const cors = () =>
  cors({
    origin: [
      'https://spy-undercover.pages.dev',   // 生产 (CF Pages)
      'http://localhost:5173',               // 开发
      'http://localhost:4173',               // preview
    ],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,                          // preflight 缓存 24h
  });
```

#### 频率限制（Sliding Window Log）

使用 KV 实现滑动窗口限流：

```typescript
// middleware/rateLimit.ts
// Key 设计: "ratelimit:{clientIP}"
// Value: JSON 数组 [{ts: number}, ...]
// 策略: 60 秒窗口内最多 60 次请求
// 清理: 每次写入时顺便清理过期条目

const RATE_LIMIT_WINDOW = 60_000;  // 60s
const RATE_LIMIT_MAX = 60;          // 60 requests per window

async function checkRateLimit(ip: string, env: Env): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const key = `ratelimit:${ip}`;
  const now = Date.now();
  const existing = await env.KV.get(key);

  let requests: number[] = [];
  if (existing) {
    requests = JSON.parse(existing);
  }

  // 清理过期
  requests = requests.filter(ts => now - ts < RATE_LIMIT_WINDOW);

  if (requests.length >= RATE_LIMIT_MAX) {
    const oldestInWindow = requests[0];
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + RATE_LIMIT_WINDOW,
    };
  }

  requests.push(now);
  await env.KV.put(key, JSON.stringify(requests), {
    expirationTtl: 60,  // 60s 后自动清理
  });

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - requests.length,
    resetAt: now + RATE_LIMIT_WINDOW,
  }
}
```

**为什么选 Sliding Window 而非 Fixed Window**:
- Fixed Window 在窗口边界可能出现 2x 突发流量（如第 59 秒和第 61 秒各 60 次）
- Sliding Window 保证任意连续 60s 内不超过 60 次
- KV 存储成本极低（每个 IP 仅一个 key，value < 1KB）

#### 统一错误处理

```typescript
// middleware/errorHandler.ts
// 所有 API 错误遵循统一格式
interface ApiError {
  success: false;
  error: string;           // 人类可读消息
  code: string;            // 机器可读错误码
  requestId: string;       // 追踪 ID
  timestamp: string;       // ISO 8601
}

// 错误码表
const ERROR_CODES = {
  INVALID_PARAM: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
```

---

## 4. 爬虫模块设计

> ⚠️ **v1.1 预览设计**：本节内容为 v1.1 版本（在线词库功能）的预览设计。
> **MVP (v1.0) 不包含爬虫模块**，MVP 仅使用内置词库 + CF Workers API 提供静态词库查询。
> 爬虫模块将在 Sprint 5 开发，届时可能根据实际需求调整本设计。

### 4.1 数据源列表及优先级

| 优先级 | 数据源 | URL/Endpoint | 格式 | 可靠性 | 说明 |
|--------|--------|-------------|------|--------|------|
| **P0** | GitHub 开源词库仓库 | `https://raw.githubusercontent.com/{org}/{repo}/main/words.json` | JSON | ⭐⭐⭐ 高 | MIT 协议，结构化数据，无需解析 |
| **P1** | 百度热搜/微博热搜 API | 通过公开 API 或页面抓取 | HTML/JSON | ⭐⭐ 中 | 需要正则/字符串提取，可能变更格式 |
| **P2** | 公开的"谁是卧底"词库汇总页 | 特定 H5 页面/论坛帖 | HTML | ⭐ 低 | 非结构化，需要复杂解析 |
| **P3** | 本地种子词库 | Worker 内置静态数组 | TypeScript | ⭐⭐⭐ 高 | 完全可控，永远不会失败 |

**数据源选择理由**:

- **GitHub P0**: 已存在多个 MIT 协议的开源词库仓库（搜索 "谁是卧底 词库" 可找到），直接拉取 JSON 无需解析，最稳定
- **热搜 P1**: 热搜词条天然是"大家都熟悉的词"，适合做平民词，配合相似词生成卧底词
- **汇总页 P2**: 补充来源，但稳定性差，仅作补充
- **本地种子 P3**: 兜底方案，确保即使所有外部源都失败仍有基础词库

### 4.2 爬取流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cron Trigger (每日 22:00 UTC+8)               │
│                              │                                   │
│                              ▼                                   │
│                   ┌──────────────────┐                          │
│                   │  1. 读取当前版本   │                          │
│                   │  KV: words:meta   │                          │
│                   └────────┬─────────┘                          │
│                            │                                    │
│              ┌─────────────┼─────────────┐                     │
│              ▼             ▼             ▼                     │
│     ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│     │ P0: GitHub │ │ P1: 热搜   │ │ P2: 汇总页  │              │
│     │ fetch JSON │ │ fetch HTML │ │ fetch HTML │              │
│     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘              │
│           │               │               │                    │
│           ▼               ▼               ▼                    │
│     ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│     │ 解析 JSON   │ │ 正则提取    │ │ 正则/选择器 │              │
│     │ → WordPair[]│ │ → keyword[]│ │ → WordPair[]│              │
│     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘              │
│           │               │               │                    │
│           └───────────────┼───────────────┘                    │
│                           ▼                                     │
│                   ┌──────────────────┐                          │
│                   │  2. 合并原始数据   │                          │
│                   │  rawWords[] 合并   │                          │
│                   └────────┬─────────┘                          │
│                            │                                    │
│                            ▼                                    │
│                   ┌──────────────────┐                          │
│                   │  3. 去重           │                          │
│                   │  by (wordA+wordB)  │                          │
│                   └────────┬─────────┘                          │
│                            │                                    │
│                            ▼                                    │
│                   ┌──────────────────┐                          │
│                   │  4. 词条配对       │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│                   │  (详见 4.3)       │                    │    ││
│                   └────────┬─────────┘                    │    ││
│                            │                              │    ││
│                            ▼                              │    ││
│                   ┌──────────────────┐                    │    ││
│                   │  5. 敏感词过滤     │ ← ─ ─ ─ ─ ─ ─ ─ ─ ┘    ││
│                   │  (详见 4.4)       │                          ││
│                   └────────┬─────────┘                          │
│                            │                                    │
│                            ▼                                    │
│                   ┌──────────────────┐                          │
│                   │  6. 难度自动标注    │                          │
│                   │  (词频/字数启发式)  │                          │
│                   └────────┬─────────┘                          │
│                            │                                    │
│                            ▼                                    │
│                   ┌──────────────────┐                          │
│                   │  7. 与现有词库合并  │                          │
│                   │  增量更新: 只加新的  │                          │
│                   └────────┬─────────┘                          │
│                            │                                    │
│                            ▼                                    │
│                   ┌──────────────────┐                          │
│                   │  8. 写入 KV        │                          │
│                   │  words:v1 (全量)   │                          │
│                   │  words:meta (元)   │                          │
│                   │  words:today (今日) │                          │
│                   └──────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

#### 伪代码

```typescript
// crawler/index.ts
export async function runCrawler(env: Env): Promise<CrawlResult> {
  // 1. 读取当前元信息
  const meta = await getMeta(env.KV);
  const existingIds = new Set(meta.wordIds);

  // 2. 并行抓取各数据源（Promise.allSettled，不因单源失败中断）
  const sourceResults = await Promise.allSettled([
    fetchFromGithub(env),
    fetchFromHotwords(env),
    fetchFromFallbackPages(env),
  ]);

  // 3. 提取 + 合并原始词条
  const rawPairs: RawWordPair[] = [];
  for (const result of sourceResults) {
    if (result.status === 'fulfilled') {
      rawPairs.push(...result.value);
    } else {
      console.error(`Source failed: ${result.reason}`);
    }
  }

  // 4. 去重
  const deduped = deduplicate(rawPairs);  // by civilian_word + spy_word

  // 5. 过滤已有词对（增量更新）
  const newPairs = deduped.filter(p => !existingIds.has(makePairKey(p)));

  // 6. 词条配对（针对只有单边词条的热搜源）
  const paired = await pairUpWords(newPairs);

  // 7. 敏感词过滤
  const filtered = filterSensitive(paired);

  // 8. 难度标注
  const annotated = annotateDifficulty(filtered);

  // 9. 合并到现有词库
  const fullLibrary = [...meta.allWords, ...annotated];

  // 10. 写入 KV
  const newMeta: WordMeta = {
    version: bumpVersion(meta.version),
    totalWords: fullLibrary.length,
    lastUpdated: new Date().toISOString(),
    wordIds: fullLibrary.map(w => w.id),
    checksum: computeChecksum(fullLibrary),
  };

  // KV 单值限制 25MB，超限时截断旧词或迁移 R2
  const payload = JSON.stringify(fullLibrary);
  if (payload.length > 25 * 1024 * 1024) {
    await storeToR2(env.R2, payload);  // 降级到 R2
  } else {
    await env.KV.put('words:v1', payload, { expirationTtl: 30 * 24 * 3600 }); // 30天 TTL
  }
  await env.KV.put('words:meta', JSON.stringify(newMeta));
  await env.KV.put('words:today', JSON.stringify(annotated.slice(0, 20)), {
    expirationTtl: 48 * 3600,  // 48h TTL
  });

  return { added: annotated.length, total: fullLibrary.length, errors: [] };
}
```

### 4.3 词条配对算法

**核心挑战**：热搜源只提供单边词条（如"奥特曼"），需要为其生成语义相似的配对词（如"假面骑士"）。

**方案：模板映射为主 + 近义词辅助**

```
┌──────────────────────────────────────────────┐
│              词条配对算法流程                 │
│                                              │
│  输入: ["奥特曼", "奶茶", "区块链"]          │
│                                              │
│  Step 1: 分类匹配                            │
│  ┌─────────────────────────────────────┐    │
│  │  映射表: 类别 → 相似词候选池          │    │
│  │  动漫角色 → [奥特曼↔假面骑士,         │    │
│  │             鸣人↔佐助, 柯南↔金田一]    │    │
│  │  饮品     → [奶茶↔咖啡, 可乐↔雪碧]     │    │
│  │  科技     → [量子计算↔AI,             │    │
│  │             区块链↔Web3]              │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Step 2: 模板匹配（精确匹配优先）            │
│  ┌─────────────────────────────────────┐    │
│  │  如果词条存在于映射表中 → 直接返回配对  │    │
│  │  例: "奥特曼" → "假面骑士" ✅         │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Step 3: 近义词库匹配（模糊匹配）            │
│  ┌─────────────────────────────────────┐    │
│  │  使用预置近义词字典做模糊匹配          │    │
│  │  例: "快乐" → 近义词库找 "开心"       │    │
│  │  匹配度 > 阈值(0.7) 则接受            │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Step 4: 无法配对 → 标记待人工审核           │
│  ┌─────────────────────────────────────┐    │
│  │  放入 pending 队列，不入正式词库       │    │
│  │  v2.0 可接入 LLM 自动配对             │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  输出: [{wordA:"奥特曼", wordB:"假面骑士"},  │
│         {wordA:"奶茶", wordB:"咖啡"}, ...]   │
└──────────────────────────────────────────────┘
```

**映射表数据结构**（Worker 内置静态数据）：

```typescript
// crawler/matcher.ts
interface PairTemplate {
  category: string;           // 分类
  pairs: Array<[string, string]>;  // [词A, 词B] 双向映射
  // 单向映射也存为两个方向
}

const PAIR_TEMPLATES: PairTemplate[] = [
  {
    category: '动漫',
    pairs: [
      ['奥特曼', '假面骑士'],
      ['鸣人', '佐助'],
      ['柯南', '金田一'],
      ['路飞', '鸣人'],  // 交叉配对也合法
      ['孙悟空', '贝吉塔'],
    ],
  },
  {
    category: '饮品',
    pairs: [
      ['奶茶', '咖啡'],
      ['可乐', '雪碧'],
      ['绿茶', '红茶'],
      ['豆浆', '牛奶'],
    ],
  },
  // ... 更多分类
  // 目标: MVP 至少覆盖 15+ 分类, 200+ 模板对
];
```

**配对算法伪代码**：

```typescript
function pairUpWords(rawList: RawWordPair[]): WordPair[] {
  const results: WordPair[] = [];
  const used = new Set<string>();

  for (const item of rawList) {
    if (used.has(item.word)) continue;

    // Step 1: 精确模板匹配
    const templateMatch = findInTemplates(item.word);
    if (templateMatch && !used.has(templateMatch)) {
      results.push({
        id: generateId(),
        civilian_word: item.word,
        spy_word: templateMatch,
        category: item.category || guessCategory(item.word),
        difficulty: 'medium',  // 后续自动调整
        source: 'crawler-paired',
        created_at: new Date().toISOString(),
      });
      used.add(item.word);
      used.add(templateMatch);
      continue;
    }

    // Step 2: 近义词匹配
    const synonymMatch = findSynonym(item.word);
    if (synonymMatch && !used.has(synonymMatch)) {
      results.push(/* ... */);
      used.add(item.word);
      used.add(synonymMatch);
      continue;
    }

    // Step 3: 无法配对 → 跳过（记录日志供人工审核）
    logUnpaired(item.word);
  }

  return results;
}
```

### 4.4 敏感词过滤方案

**分层过滤策略**：

```
输入词条 → ┌────────────────────────────────────┐
           │  Layer 1: 黑名单精确匹配（最快）      │
           │  • 政治/宗教敏感词 (~200 条)          │
           │  • 色情/暴力词汇 (~100 条)            │
           │  • O(1) HashSet lookup               │
           └────────────────┬───────────────────┘
                            │ 通过
                            ▼
           ┌────────────────────────────────────┐
           │  Layer 2: 正则模式匹配               │
           │  • 电话号码/身份证模式               │
           │  • URL/域名模式                      │
           │  • 广告推广关键词                    │
           │  • SQL/HTML 注入片段                 │
           └────────────────┬───────────────────┘
                            │ 通过
                            ▼
           ┌────────────────────────────────────┐
           │  Layer 3: 长度/字符验证              │
           │  • 1 ≤ length ≤ 20 字               │
           │  • 仅允许中文/英文/数字/常用标点      │
           │  • 拒绝纯数字/纯特殊字符             │
           └────────────────┬───────────────────┘
                            │ 通过
                            ▼
                      ✅ 进入词库
```

**实现**：

```typescript
// crawler/filter.ts

// Layer 1: 黑名单（HashSet，启动时构建为 Set）
const BLOCKLIST = new Set([
  // 政治敏感（示例，实际列表更长）
  // 色情/暴力（示例）
  // 注: 这是一个最小化的示例，实际运营中维护完整列表
]);

// Layer 2: 正则模式
const FILTER_PATTERNS = [
  /1[3-9]\d{9}/g,              // 手机号
  /\d{17}[\dXx]/g,             // 身份证
  /https?:\/\/\S+/gi,          // URL
  /[\x00-\x1f\x7f]/g,          // 控制字符
  /^[\d\s\-+().]+$/,           // 纯数字/符号
];

// Layer 3: 字符验证
const VALID_CHAR_RE = /^[\u4e00-\u9fa5a-zA-Z0-9·\-（）【】\[\]]+$/;

function filterSensitive(pairs: WordPair[]): WordPair[] {
  return pairs.filter(pair => {
    const words = [pair.civilian_word, pair.spy_word];

    for (const word of words) {
      // Layer 1
      if (BLOCKLIST.has(word.trim())) return false;

      // Layer 2
      for (const pattern of FILTER_PATTERNS) {
        if (pattern.test(word)) return false;
      }

      // Layer 3
      if (!VALID_CHAR_RE.test(word)) return false;
      if (word.length < 1 || word.length > 20) return false;
    }

    return true;
  });
}
```

### 4.5 失败处理与降级策略

```
Cron 触发爬取
    │
    ├── P0 GitHub 成功？
    │       ├── 是 → 使用 GitHub 数据 ✓
    │       └── 否 → 记录错误日志，继续尝试其他源
    │
    ├── P1 热搜成功？
    │       ├── 是 → 合并热搜数据
    │       └── 否 → 跳过，记录日志
    │
    ├── P2 汇总页成功？
    │       ├── 是 → 合并补充数据
    │       └── 否 → 跳过，记录日志
    │
    ├── 所有外部源都失败？
    │       └── → 使用 P3 本地种子词库（保证不返回空）
    │
    ├── 新增词对数量 == 0？
    │       └── → 不更新 KV（保留旧数据），返回 "no new words"
    │
    ├── KV 写入失败？
    │       └── → 重试 1 次 → 仍失败则发送告警（console + 可选 webhook）
    │
    └── 完成 → 更新 words:meta 中的 lastCrawlStatus
```

**核心原则**：
1. **任何单一源失败都不影响整体流程**（`Promise.allSettled`）
2. **至少有本地种子词库兜底**（保证词库不为空）
3. **写入失败不丢失旧数据**（先写成功再更新 meta）
4. **所有异常都有日志**（CF Workers Dashboard 的 Logs 可查）

---

## 5. 数据模型

### 5.1 WordPair 类型（服务端/共享）

```typescript
// types/worker.ts (Worker 侧) & types/words.ts (前端侧)

interface WordPair {
  /** 唯一标识, 格式 "w" + 递增数字 */
  id: string;

  /** 平民词语 */
  civilian_word: string;

  /** 卧底词语（与 civilian_word 语义相似但有区别） */
  spy_word: string;

  /** 分类标签 */
  category: string;

  /** 难度等级 */
  difficulty: 'easy' | 'medium' | 'hard';

  /** 来源标识 */
  source: 'builtin' | 'github' | 'hotword' | 'crawler-paired' | 'custom' | 'ai';

  /** 创建时间 (ISO 8601) */
  created_at: string;
}
```

**字段约束**：

| 字段 | 约束 | 说明 |
|------|------|------|
| `id` | 唯一, 不可变 | `"w001"` ~ `"w999+"` |
| `civilian_word` | 1-20 中文字符 | 不可为空, 不可与 spy_word 相同 |
| `spy_word` | 1-20 中文字符 | 同上 |
| `category` | 非空字符串 | 如 "水果"、"动漫"、"科技" |
| `difficulty` | enum 3 值 | 由标注算法或人工指定 |
| `source` | enum 6 值 | 标识数据来源，便于追溯和质量分析 |
| `created_at` | ISO 8601 | 词对创建时间 |

### 5.2 Game State 类型（前端）

```typescript
// types/game.ts

type Role = 'civilian' | 'spy' | 'blank';
type GamePhase =
  | 'idle'        // 空闲（首页）
  | 'setup'       // 设置中
  | 'dealing'     // 发牌中（翻牌查看阶段）
  | 'playing'     // 游戏进行中（描述阶段）
  | 'voting'      // 投票中
  | 'voteResult'  // 投票结果展示
  | 'reveal';     // 揭晓（游戏结束）

interface Player {
  /** 玩家唯一 ID (1-based) */
  id: number;

  /** 显示名称 */
  name: string;

  /** 分配到的词语（白板角色为 null） */
  word: string | null;

  /** 角色 */
  role: Role;

  /** 是否存活 */
  isAlive: boolean;

  /** 发牌阶段是否已翻牌查看 */
  isRevealed: boolean;

  /** 当前轮得票数（投票阶段使用） */
  votes: number;
}

interface GameConfig {
  /** 总玩家数 [4, 12] */
  totalPlayers: number;

  /** 卧底数量 [1, 2] */
  spyCount: number;

  /** 白板数量 [0, 2] */
  blankCount: number;

  /** 游戏模式 */
  mode: 'classic' | 'whiteboard';

  /** 词库难度筛选 */
  difficulty: 'random' | 'easy' | 'medium' | 'hard';

  /** 每人描述轮次 [1, 3] */
  descriptionRounds: number;

  /** 是否启用计时器 */
  timerEnabled: boolean;

  /** 计时器秒数（默认 30） */
  timerSeconds: number;
}

interface GameState {
  /** 当前游戏阶段 */
  phase: GamePhase;

  /** 游戏配置 */
  config: GameConfig;

  /** 选中的词对 */
  selectedPair: WordPair | null;

  /** 玩家列表 */
  players: Player[];

  /** 发牌阶段: 当前查看的玩家索引 (0-based) */
  currentPlayerIndex: number;

  /** 描述阶段: 当前发言者索引 (0-based, 仅存活玩家) */
  currentSpeakerIndex: number;

  /** 当前描述轮次 (1-based) */
  currentRound: number;

  /** 投票阶段: 当前用户选中的目标玩家 ID */
  votingTarget: number | null;

  /** 胜利方 */
  winner: 'civilian' | 'spy' | null;

  /** 淘汰顺序（玩家 ID 列表，按淘汰时间排序） */
  eliminatedOrder: number[];

  /** 投票结果: 玩家ID → 得票数（Record 类型，兼容 Zustand persist 的 JSON 序列化） */
  voteResults: Record<number, number>;
}
```

### 5.3 CF KV 存储 Schema

#### Key 设计

| Key 名 | 类型 | Value 格式 | TTL | 说明 |
|--------|------|-----------|-----|------|
| `words:v1` | String | JSON (WordPair[]) | 30 天 | 全量词库数据 |
| `words:meta` | String | JSON (WordMeta) | 无 | 词库元信息 |
| `words:today` | String | JSON (WordPair[]) | 48 小时 | 今日新增词对 |
| `ratelimit:{ip}` | String | JSON (number[]) | 60 秒 | 限流滑动窗口 |
| `admin:lastRefresh` | String | ISO 8601 时间戳 | 24 小时 | 上次手动刷新时间 |

#### Value 详细格式

**words:v1** (全量词库):
```json
[
  {
    "id": "w001",
    "civilian_word": "苹果",
    "spy_word": "梨子",
    "category": "水果",
    "difficulty": "easy",
    "source": "builtin",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

> **大小估算**: 200 词对 ≈ 40KB JSON; 500 词对 ≈ 100KB; 2000 词对 ≈ 400KB。远低于 KV 25MB 限制。

**words:meta** (元信息):
```json
{
  "version": "1.2.0",
  "totalWords": 450,
  "lastUpdated": "2026-04-25T06:00:00Z",
  "lastCrawlStatus": "success",
  "checksum": "sha256:a1b2c3d4e5f6...",
  "wordIds": ["w001", "w002", "w003"]
}
```

**words:today** (今日新词):
```json
[
  {
    "id": "w451",
    "civilian_word": "新词A",
    "spy_word": "新词B",
    "category": "网络热梗",
    "difficulty": "medium",
    "source": "hotword",
    "created_at": "2026-04-26T06:00:00Z"
  }
]
```

#### TTL 策略

| 数据 | TTL | 理由 |
|------|-----|------|
| 词库数据 (`words:v1`) | 30 天 | 词库每日更新，30 天足够长；即使 Cron 多天失败，旧数据仍可用 |
| 元信息 (`words:meta`) | 无 TTL | 小对象，常驻即可 |
| 今日新词 (`words:today`) | 48 小时 | "今日"概念，2 天后失效 |
| 限流计数器 | 60 秒 | 滑动窗口精确匹配 |
| 刷新锁 | 24 小时 | 防止频繁手动触发 |

### 5.4 R2 存储方案（扩容预案）

当词库超过 **15000+ 对**（约 3MB+ JSON）时考虑迁移到 R2。

**R2 存储结构**：
```
spy-undercover-bucket/
├── words/
│   ├── full.json              # 全量词库 (gzip 压缩)
│   ├── delta/                 # 增量文件
│   │   ├── 2026-04-25.json
│   │   └── 2026-04-26.json
│   └── archive/
│       └── 2026-03.json      # 月度归档
└── meta/
    └── latest.json            # 最新元信息（同步 KV）
```

**访问模式**：
- 读: `env.R2.get(bucket, 'words/full.json')` → Synchronous Access（CF Workers 支持）
- 写: 仅 Cron 任务写入
- 缓存: KV 存储 `words:r2_etag` + `words:r2_checksum` 做 cache validation

> **MVP 阶段不需要 R2**。KV 的 25MB 限额可存储约 100 万词对（远超需求）。此方案仅为未来扩容预留。

---

## 6. 词库保护策略

### 6.1 API 频率限制实现细节

| 维度 | 配置 | 说明 |
|------|------|------|
| 窗口算法 | Sliding Window Log | 任意连续 60s 内精确限制 |
| 窗口大小 | 60 秒 | 平衡用户体验与防护 |
| 阈值 | 60 次/分钟/IP | 正常游戏使用约 3-5 次/局，绰绰有余 |
| 存储位置 | CF KV | `ratelimit:{ip}` key |
| Key TTL | 60 秒 | 自动清理，防止 KV 膨胀 |
| 超限响应 | HTTP 429 + `Retry-After: 60` | 客户端指数退避重试 |

**特殊路径豁免**:
- `/api/health`: 无限流（用于监控探针）
- `/api/words/today`: 独立限制 20 次/分钟（首页轻量接口）

### 6.2 单次请求返回数量限制

| 接口 | 最大返回数 | 理由 |
|------|-----------|------|
| `GET /api/words?limit=` | **200** | 单次请求足够多局使用，防止批量导出 |
| `GET /api/words/random?count=` | **50** | 随机获取上限，防止遍历全量词库 |
| `GET /api/words/today` | **20** | 今日新词数量自然限制 |

**前端配合**: 即使拿到 200 对词，也只在内存中使用需要的部分（通常每局 1 对），不会全量存储到 localStorage。

### 6.3 API Key / Token 机制

**决策：MVP 不需要公共 API Key。**

理由：
1. 词库数据本身非敏感（通用词汇配对）
2. 频率限制已足够防护批量爬取
3. 聚会场景用户不会配置 API Key
4. 减少使用门槛

**Token 使用范围**：

| 接口 | 认证方式 | Token 来源 |
|------|---------|-----------|
| `/api/words/*` | 无 | 公开端点 |
| `/api/health` | 无 | 公开端点 |
| `/api/admin/refresh` | **Bearer Token** | 环境变量 `ADMIN_TOKEN` |

Admin Token 通过 Wrangler secret 注入，不出现在代码仓库中：

```bash
echo "your-secret-token-here" | wrangler secret put ADMIN_TOKEN
```

### 6.4 防批量爬取策略

| 策略 | 实现方式 | 效果 |
|------|---------|------|
| **频率限制** | 60 次/min/IP | 基础防护 |
| **分页限制** | limit ≤ 200 | 单次无法获取全量 |
| **无枚举友好接口** | 不提供 `/api/words/:id` 单条接口 | 难以遍历 |
| **无 dump 接口** | 不提供"下载全部词库"接口 | 必须分页慢慢爬 |
| **CF Bot 管理** | Cloudflare Bot Fight Mode | 自动识别恶意爬虫 |
| **Checksum 校验** | 响应带 checksum，客户端可验完整性 | 防篡改（次要作用） |
| **User-Agent 分析** | 日志记录异常 UA（curl/python-requests 等） | 运营层面感知 |

> **坦诚评估**：以上措施可以阻止 casual 批量爬取，但无法防止有决心的攻击者完全复制词库。考虑到词库是非敏感的通用词汇，这个防护级别足够。如果未来词库成为核心资产（如付费词库包），可升级为签名 API Key 机制。

---

## 7. 部署方案

### 7.1 整体部署架构

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                     │
│                  spy-undercover (mono-repo)               │
│                                                          │
│  ├── frontend/           (React SPA → CF Pages)          │
│  └── worker/             (CF Workers API)                │
└───────────────────────────┬─────────────────────────────┘
                            │ push to main
                            ▼
                 ┌────────────────────────┐
                 │   GitHub Actions CI/CD  │
                 │                        │
                 │  ┌──────────────────┐  │
                 │  │ Frontend Build    │  │
                 │  │ npm ci + build    │  │
                 │  │       ↓           │  │
                 │  │ CF Pages Deploy   │  │
                 │  └──────────────────┘  │
                 │                        │
                 │  ┌──────────────────┐  │
                 │  │ Worker Build      │  │
                 │  │ npm ci + build    │  │
                 │  │       ↓           │  │
                 │  │ Wrangler deploy   │  │
                 │  └──────────────────┘  │
                 └────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼              ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────┐
     │ CF Pages     │ │ CF Workers│ │ CF KV    │
     │ (前端静态)    │ │ (API)    │ │ (词库)   │
     │ *.pages.dev  │ │ *.workers │ │          │
     └──────────────┘ └──────────┘ └──────────┘
```

### 7.2 前端部署：Cloudflare Pages

**wrangler.toml (frontend)**:
```toml
name = "spy-undercover-web"
compatibility_date = "2026-04-26"

[build]
command = "npm run build"
output_dir = "dist"
```

**部署命令**:
```bash
# 开发
npm run dev          # Vite dev server :5173

# 预览构建
npm run preview      # Vite preview :4173

# 部署 (CI/CD)
npx wrangler pages deploy dist --project-name=spy-undercover-web
```

**自定义域名（可选）**:
```
spy.example.com  →  CNAME  →  spy-undercover-web.pages.dev
```

### 7.3 后端部署：Cloudflare Workers

**wrangler.toml (worker)**:
```toml
name = "spy-undercover-api"
main = "src/index.ts"
compatibility_date = "2026-04-26"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyy"

# R2 (预留, MVP 不启用)
# [[r2_buckets]]
# binding = "R2"
# bucket_name = "spy-undercover-data"

[triggers]
crons = ["0 18 * * *"]  # 每天 UTC 18:00 = 北京时间 02:00 (次日)
# 注: 实际建议 UTC 22:00 = 北京时间 06:00
# 即 crons = ["0 22 * * *"]

[vars]
ENVIRONMENT = "production"
ADMIN_TOKEN_EXPIRY = "86400"
```

**部署命令**:
```bash
# 开发 (local KV 模拟)
npx wrangler dev          # Hot reload + local :8787

# 部署
npx wrangler deploy

# 远程日志
npx wrangler tail         # 实时查看 production logs
```

### 7.4 CI/CD 方案：GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:  # 手动触发

jobs:
  # Job 1: 前端部署到 CF Pages
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: frontend/package.json

      - working-directory: frontend
        run: npm ci
      - working-directory: frontend
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: pages deploy dist --project-name=spy-undercover-web
        working-directory: frontend

  # Job 2: 后端部署到 CF Workers
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: worker/package.json

      - working-directory: worker
        run: npm ci
      - working-directory: worker
        run: npm run build       # TypeScript 编译检查

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: deploy
        working-directory: worker
```

### 7.5 环境变量管理

| 环境 | 变量 | 存储位置 | 说明 |
|------|------|---------|------|
| Production | `CF_API_TOKEN` | GitHub Secrets | CF API Token（部署权限） |
| Production | `ADMIN_TOKEN` | Wrangler Secret | 管理员接口密钥 |
| Production | `KV_NAMESPACE_ID` | Wrangler 配置 | KV namespace ID |
| Development | — | `.dev.vars` | 本地开发变量（不提交 git） |
| Preview | — | CF Preview 环境 | 自动创建 preview KV |

**`.dev.vars` (本地开发, gitignored)**:
```bash
# .dev.vars (worker/)
ADMIN_TOKEN="dev-token-for-testing-only"
KV_ID=""
```

---

## 8. 性能与安全

### 8.1 前端性能目标

| 指标 | 目标值 | 测量方案 | 优化手段 |
|------|--------|---------|----------|
| **FCP** (First Contentful Paint) | **< 1.2s** | Lighthouse CI | Vite 代码分割; 关键 CSS 内联; 预加载字体 |
| **LCP** (Largest Contentful Paint) | **< 1.8s** | Lighthouse CI | 首屏仅渲染文字+按钮（无大图）; system font |
| **TTI** (Time to Interactive) | **< 2.0s** | Lighthouse CI | 懒加载非首屏组件（VoteResult/Reveal） |
| **CLS** (Cumulative Layout Shift) | **< 0.05** | Lighthouse CI | 固定尺寸容器; 字体 `font-display: swap` |
| **包体积 (gzipped)** | **< 160KB** (JS+CSS) | Build output | Tree-shaking; Iconify 按需加载; 不引入 moment.js 等重型库 |
| **翻牌动画帧率** | **≥ 55fps** | DevTools Performance | Framer Motion GPU 加速 (transform/opacity only) |
| **Lighthouse Performance** | **≥ 92** | Lighthouse Audit | 持续监控，CI 卡线 |

**Bundle 预算分配**：

| 类别 | 预估大小 (gzipped) | 说明 |
|------|-------------------|------|
| React + ReactDOM | ~44KB | 核心框架（不可避免） |
| Zustand | ~1KB | 极简状态管理 |
| Framer Motion | ~28KB (gzip) | 动画库（按需 import，不用全局） |
| TailwindCSS (CSS) | ~10KB (gzip) | PurgeCSS 后仅保留使用到的类 |
| Iconify | ~5KB (gzip) | 按需加载使用的图标 |
| 应用代码 + 内置词库 | ~50KB | 业务逻辑 + 200 对词对 JSON |
| **总计** | **~138KB** | **< 160KB 目标 ✅** |

### 8.2 API 响应时间目标

| 接口 | P50 目标 | P99 目标 | 优化手段 |
|------|---------|---------|----------|
| `GET /api/health` | < 20ms | < 50ms | 无 KV 读取，纯内存响应 |
| `GET /api/words/today` | < 50ms | < 100ms | 单次 KV 读取 + Edge Cache 1h |
| `GET /api/words/random?count=10` | < 80ms | < 150ms | KV 全量读取 + 内存过滤 + Edge Cache 5min |
| `GET /api/words?page=1&limit=50` | < 80ms | < 150ms | KV 读取 + JSON.parse + 分页切片 |
| `POST /api/admin/refresh` | < 500ms | < 2s | 触发异步爬取，不等待完成即返回 |

> **注意**: CF Workers 冷启动（Cold Start）约 5-50ms（免费版），Paid 版本 < 5ms。KV 读取约 1-10ms（全球平均）。上述目标已包含冷启动开销。

### 8.3 缓存策略

```
┌──────────────────────────────────────────────────────┐
│                    缓存层次                          │
│                                                      │
│  L1: 浏览器内存缓存 (Zustand store)                   │
│  ├── 词库数据加载后常驻内存                           │
│  ├── 游戏期间不重新请求                               │
│  └── 生命周期: 页面关闭即释放                         │
│                                                      │
│  L2: localStorage 缓存 (前端持久化)                   │
│  ├── API 响应写入 localStorage (带版本号)             │
│  ├── 下次启动优先从 localStorage 加载                 │
│  └── 后台静默校验 freshness (version + checksum)      │
│                                                      │
│  L3: Cloudflare Edge Cache (CDN 节点)                │
│  ├── /api/words/today → Cache 3600s                  │
│  ├── /api/words/random → Cache 300s (by query)      │
│  ├── /api/words → Cache 300s (by query)              │
│  └── /api/health → no-cache (实时)                   │
│                                                      │
│  L4: Cloudflare KV (源头)                            │
│  ├── 真实数据源                                       │
│  ├── 全球读取延迟 1-10ms                             │
│  └── Cron 每日更新                                    │
└──────────────────────────────────────────────────────┘
```

**Cache Header 配置**:

```typescript
// 各路由的 cache-control 策略
const CACHE_POLICY = {
  '/api/health':        'no-store',           // 实时状态
  '/api/words':         'public, max-age=300',  // 5 分钟
  '/api/words/random':  'public, max-age=300',  // 5 分钟
  '/api/words/today':   'public, max-age=3600', // 1 小时
} as const;
```

**Stale-While-Revalidate 策略** (前端):

```typescript
// services/wordApi.ts — 智能加载策略
async function loadWordBank(): Promise<WordBank> {
  // 1. 先用 localStorage 缓存立即渲染 UI
  const cached = loadFromLocalStorage();
  if (cached) {
    // 2. 后台静默检查更新
    checkForUpdate(cached.version).then(fresh => {
      if (fresh) { saveToLocalStorage(fresh); }
    });
    return cached;  // 先返回旧数据
  }

  // 3. 无缓存 → 从 API 加载
  return fetchFromAPI();
}
```

### 8.4 安全措施

| 威胁 | 防护方案 | 实现位置 |
|------|---------|----------|
| XSS | DOMPurify 自定义词库消毒；无 innerHTML 注入；CSP 头 | 前端 + CF Pages |
| CSRF | API 只读为主（GET）；写操作需 Bearer Token | 后端 |
| 数据泄露 | 无用户数据收集；词库为通用公开词汇 | 架构层面 |
| 依赖投毒 | lockfile; 定期 `npm audit`; CI 自动扫描 | CI/CD |
| DDoS | CF DDoS 防护（免费版包含）；频率限制 | Cloudflare 平台 |
| 中间人攻击 | 全站 HTTPS（CF 自动颁发证书） | Cloudflare 平台 |
| 滥用 API | Sliding Window Rate Limit + 单次数量限制 | Worker 中间件 |

**CSP 头配置** (CF Pages):

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://spy-undercover-api.workers.dev; img-src 'self' data:; font-src 'self' https://api.iconify.design;
```

---

## 9. 关键业务逻辑

### 9.1 发牌算法

**输入**: 总人数 N, 卧底数 S, 白板数 B, 选定词对 (wordA, wordB)
**输出**: N 个 Player 对象的数组（已随机排列）

```typescript
// services/dealer.ts
interface DealResult {
  players: Player[];
  civilianWord: string;   // 平民词语
  spyWord: string;       // 卧底词语
}

function deal(config: GameConfig, wordPair: WordPair): DealResult {
  const { totalPlayers: N, spyCount: S, blankCount: B } = config;
  const civilianCount = N - S - B;

  // === 前置约束校验 ===
  if (N < 4 || N > 12) throw new Error('人数必须在 4-12 人之间');
  if (S < 1 || S > 2) throw new Error('卧底数必须为 1 或 2');
  if (civilianCount < 1) throw new Error('平民数不足');
  if (civilianCount <= S) throw new Error('平民数必须大于卧底数');
  if (B > Math.floor((N - S - 1) / 2)) throw new Error('白板数超限');
  if (N <= 5 && S > 1) throw new Error('5人及以下最多1个卧底');

  // === 构建角色池 ===
  const pool: Role[] = [
    ...Array(civilianCount).fill('civilian'),
    ...Array(S).fill('spy'),
    ...Array(B).fill('blank'),
  ];

  // === Fisher-Yates 洗牌 ===
  shuffle(pool);  // O(n) in-place shuffle

  // === 构建玩家列表 ===
  const players: Player[] = pool.map((role, index) => ({
    id: index + 1,
    name: `玩家 ${index + 1}`,
    word: role === 'blank' ? null : (role === 'civilian' ? wordPair.civilian_word : wordPair.spy_word),
    role,
    isAlive: true,
    isRevealed: false,
    votes: 0,
  }));

  return { players, civilianWord: wordPair.civilian_word, spyWord: wordPair.spy_word };
}
```

**算法复杂度**: O(N) 时间, O(N) 空间
**随机性保证**: Fisher-Yates 洗牌是均匀分布的，每个排列的概率 = 1/N!

**角色分布示例**:

| 人数 | 卧底 | 白板 | 平民 | 分布 |
|------|-----|------|------|------|
| 4 | 1 | 0 | 3 | 3 平 vs 1 卧 |
| 6 | 1 | 0 | 5 | 5 平 vs 1 卧 |
| 6 | 1 | 1 | 4 | 4 平 vs 1 卧 vs 1 白 |
| 6 | 2 | 0 | 4 | 4 平 vs 2 卧 |
| 8 | 2 | 1 | 5 | 5 平 vs 2 卧 vs 1 白 |
| 10 | 2 | 2 | 6 | 6 平 vs 2 卧 vs 2 白 |
| 12 | 2 | 2 | 8 | 8 平 vs 2 卧 vs 2 白 |

### 9.2 投票计票与平票处理

**投票流程**:

```
所有存活玩家依次投票（传手机模式，每人一票）
    │
    ▼
统计每人的得票数
    │
    ▼
找出最高票数 maxVotes
    │
    ├── 只有一人达到 maxVotes → 该人被淘汰 ✅
    │
    └── 多人平票 → 进入 PK 投票
            │
            ▼
       仅在平票者中重新投票
            │
            ├── 仍平票 → 随机淘汰一人（从平票者中随机选）
            └── 分出胜负 → 最高票者被淘汰
```

**实现**:

```typescript
function processVote(
  alivePlayers: Player[],
  votes: Map<number, number>
): { eliminated: Player | null; isTie: boolean } {
  // 1. 统计得票
  const voteCounts = Array.from(votes.entries())
    .filter(([id]) => alivePlayers.find(p => p.id === id)?.isAlive)
    .map(([id, count]) => ({ id, count }));

  if (voteCounts.length === 0) return { eliminated: null, isTie: false };

  // 2. 找最高票
  const maxVotes = Math.max(...voteCounts.map(v => v.count));
  const topCandidates = voteCounts.filter(v => v.count === maxVotes);

  // 3. 唯一最高票 → 直接淘汰
  if (topCandidates.length === 1) {
    const eliminated = alivePlayers.find(p => p.id === topCandidates[0].id)!;
    return { eliminated, isTie: false };
  }

  // 4. 平票处理
  // 方案: 在平票者中随机淘汰一人（简化流程，适合聚会场景）
  // 理由: 聚会场景不想花时间反复 PK 投票，快速随机更流畅
  const randomIndex = Math.floor(Math.random() * topCandidates.length);
  const eliminated = alivePlayers.find(p => p.id === topCandidates[randomIndex].id)!;
  return { eliminated, isTie: true };
}
```

**为什么选择随机淘汰而非 PK 投票**:

| 因素 | PK 投票 | 随机淘汰 |
|------|--------|----------|
| 聚会流畅度 | 低（需额外传手机投票轮） | 高（即时出结果） |
| 实现复杂度 | 中（需新 UI 状态） | 低（1 行代码） |
| 公平性 | 高（群体意志） | 中（随机但不可控） |
| 用户预期 | 不确定 | 可接受（聚会游戏本就有随机成分） |

**决策**: MVP 使用随机淘汰。v1.1 可选加 PK 投票模式（设置页开关）。

### 9.3 游戏结束判定

**⚠️ 核心规则 — 必须严格遵守**

```
每次淘汰一人后，立即执行以下检查：

  ┌─────────────────────────────────────┐
  │  1. 卧底全部被淘汰？                │
  │     → 是 → 平民获胜 ✅             │
  │     → 否 ↓                          │
  │                                     │
  │  2. 平民数 ≤ 卧底数？               │
  │     → 是 → 卧底获胜 ✅              │
  │     → 否 → 游戏继续 🔄             │
  └─────────────────────────────────────┘
```

> **规则说明**：白板视为**平民等价角色**，淘汰后游戏继续（与主流「谁是卧底」玩法一致）。
> 白板仅区别于平民的点是「没有词语」，在胜负判定中归入平民阵营计算。

**实现**:

```typescript
function checkWinCondition(players: Player[]): {
  gameOver: boolean;
  winner: 'civilian' | 'spy' | null;
} {
  const alive = players.filter(p => p.isAlive);
  // 白板归入平民阵营计算（白板是平民等价角色）
  const aliveCivilians = alive.filter(p => p.role === 'civilian' || p.role === 'blank');
  const aliveSpies = alive.filter(p => p.role === 'spy');

  // 规则 1: 卧底全部淘汰 → 平民胜
  if (aliveSpies.length === 0) {
    return { gameOver: true, winner: 'civilian' };
  }

  // 规则 2: 平民(+白板) 数 ≤ 卧底数 → 卧底胜
  if (aliveCivilians.length <= aliveSpies.length) {
    return { gameOver: true, winner: 'spy' };
  }

  // 游戏继续
  return { gameOver: false, winner: null };
}
```

**关键场景验证**:

| 场景 | 存活 | 判定 | 结果 |
|------|------|------|------|
| 正常淘汰卧底 | 5平+1白 0卧 | 卧底=0 | **平民胜** |
| 最后1卧底+1白板被同票淘汰 | 3平 0卧 0白 | 卧底=0 | **平民胜** |
| 仅剩1平民+1白板 vs 1卧底 | 1平+1白 1卧 | 平民(含白)≤卧底(2≤1?否) | 游戏继续 🔄 |
| 仅剩1平民 vs 1卧底（无白板） | 1平 0白 1卧 | 平民≤卧底 | **卧底胜** |
| 仅剩2平民 vs 2卧底 | 2平 0白 2卧 | 平民≤卧底 | **卧底胜** |
| 白板被淘汰(卧底仍在) | 4平 0白 1卧 | 平民(4)>卧底(1) | 游戏继续 🔄 |
| 仅剩1白板 vs 1卧底 | 0平 1白 1卧 | 平民含白(1)≤卧底(1) | **卧底胜** |

### 9.4 防偷看机制实现

**需求**: 卡片默认模糊/背面显示，点击短暂查看词语，自动重新模糊。

**技术方案**: CSS `filter: blur()` + 点击切换 + 自动重模糊定时器。

```tsx
// components/game/WordCard.tsx
// hooks/useAntiPeek.ts

function useAntiPeek(options?: {
  showDuration?: number;   // 显示持续时间 (ms)，默认 3000
  autoReblur?: boolean;   // 是否自动重模糊，默认 true
}) {
  const [isBlurred, setIsBlurred] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showDuration = options?.showDuration ?? 3000;

  const showWord = useCallback(() => {
    setIsBlurred(false);           // 取消模糊
    clearTimeout(timerRef.current);

    if (options?.autoReblur !== false) {
      // 3 秒后自动重新模糊
      timerRef.current = setTimeout(() => {
        setIsBlurred(true);
      }, showDuration);
    }
  }, [showDuration, options?.autoReblur]);

  const hideWord = useCallback(() => {
    setIsBlurred(true);
    clearTimeout(timerRef.current);
  }, []);

  // 组件卸载时清理定时器
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { isBlurred, showWord, hideWord };
}
```

**WordCard 组件集成**:

```tsx
function WordCard({ player }: { player: Player }) {
  const { isFlipped, toggleFlip } = useFlipCard();  // Framer Motion 3D翻转
  const { isBlurred, showWord, hideWord } = useAntiPeek({ showDuration: 3000 });

  return (
    <motion.div
      className="relative w-64 h-80 cursor-pointer"
      onClick={isFlipped ? (isBlurred ? showWord : hideWord) : toggleFlip}
      style={{ perspective: 1000 }}
    >
      {/* 3D 翻转容器 */}
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* 背面 */}
        <div style={{ backfaceVisibility: 'hidden' }}>
          <CardBack />
        </div>

        {/* 正面 */}
        <div style={{ backfaceVisibility: 'hidden', rotateY: '180deg' }}>
          {/* 防偷看层 */}
          <div
            style={{
              filter: isBlurred ? 'blur(12px)' : 'blur(0px)',
              transition: 'filter 0.3s ease',
              userSelect: 'none',
            }}
          >
            <RoleBadge role={player.role} />
            <span className="text-3xl font-bold">
              player.word ?? '📋 白板'
            </span>
          </div>

          {!isBlurred && (
            <button onClick={(e) => { e.stopPropagation(); hideWord(); }}>
              隐藏词语
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
```

**防偷看机制层次**:

| 层次 | 机制 | 防护效果 |
|------|------|----------|
| L1 | 卡片默认背面朝上 (3D翻转) | 远距离完全看不到 |
| L2 | 翻转后词语 CSS blur(12px) | 近距离/余光无法辨认 |
| L3 | 点击才取消 blur (主动操作) | 误触不会暴露 |
| L4 | 3 秒后自动 re-blur | 忘记手动隐藏也安全 |
| L5 | 切换玩家时强制翻回 + 模糊 | 传递过程不泄露 |
| L6 | `userSelect: none` | 长按选中文也不泄露 |

**降级方案**: 检测 `prefers-reduced-motion` 时:
- 3D 翻转 → 淡入淡出替代
- blur 效果保持不变（不影响动画偏好）

---

## 附录 A: 技术栈版本锁定

| 包名 | 版本 | 用途 |
|------|------|------|
| react | ^18.3.0 | UI 框架 |
| react-dom | ^18.3.0 | DOM 渲染 |
| @types/react | ^18.3.0 | 类型定义 |
| vite | ^6.0.0 | 构建工具 |
| typescript | ~5.5.0 | 语言编译器 |
| tailwindcss | ^4.0.0 | 原子化 CSS |
| @tailwindcss/vite | ^4.0.0 | Vite Tailwind 插件 |
| framer-motion | ^11.0.0 | 动画库 |
| zustand | ^4.5.0 | 状态管理 |
| @iconify/react | ^5.0.0 | 图标库 |
| biome | ^1.9.0 | 代码质量工具 |
| hono | ^4.0.0 | Worker Web 框架 |
| wrangler | ^4.0.0 | CF CLI |

## 附录 B: 文件依赖关系图

`` App.tsx
 ├─ stores/gameStore.ts
 │   └─ services/dealer.ts (发牌算法纯函数)
 │       └─ utils/shuffle.ts
 ├─ stores/settingsStore.ts
 │
 ├─ screens/HomeScreen.tsx
 ├─ screens/SetupScreen.tsx
 │   └─ ui/Stepper.tsx, SegmentedControl.tsx, Toggle.tsx
 │
 ├─ screens/DealingScreen.tsx
 │   └─ game/WordCard.tsx
 │       ├── game/RoleBadge.tsx
 │       └─ hooks/useAntiPeek.ts
 │
 ├─ screens/PlayingScreen.tsx
 │   └─ ui/Countdown.tsx
 │       └─ hooks/useTimer.ts
 │
 ├─ screens/VotingScreen.tsx
 │   └─ game/PlayerGrid.tsx
 │       └─ game/VoteBar.tsx
 │
 ├─ screens/VoteResultScreen.tsx
 │   └─ hooks/useGame.ts (processVote + checkWinCondition)
 │
 └─ screens/RevealScreen.tsx

 services/wordApi.ts ←→ CF Workers API
 services/storage.ts → localStorage
 data/builtin-words.ts (静态导入, 200+ 词对)
```

## 附录 C: Cloudflare 免费额度与成本估算

| 资源 | 免费额度 | MVP 日均消耗 | 余量 | 付费升级 |
|------|---------|------------|------|----------|
| Workers 请求 | 10 万次/日 | ~2000 次 | **98%** | $5/1000万次 |
| Workers CPU 时间 | 10ms/次 (免费) | ~5ms/次 avg | ⚠️ 见下方说明 | $5/100万ms (Paid: 30s) |
| KV 读取 | 10 万次/日 | ~3000 次 | **97%** | $0.50/百万次 |
| KV 写入 | 1000 次/日 | ~3 次 (Cron×3 key) | **99.7%** | $0.50/百万次 |
| KV 存储 | 1 GB | ~100 KB | **99.99%** | $0.50/GB/月 |
| KV 数量 | 无限 | ~20 keys | — | — |
| Cron Triggers | 5 个 | 1 个 | **80%** | $0 (含在免费额度) |
| Pages 请求数 | 无限 | ~5000 次 | — | — |
| Pages 构建分钟 | 500 次/月 | ~30 次 | — | — |
| R2 Class A | 1000 万次/月 | 0 (MVP 不用) | — | — |
| R2 存储 | 10 GB | 0 | — | $0.15/GB/月 |

**MVP 月成本: ¥0** (免费额度远超需求)
**增长到 10 万 DAU 时预估月成本: ~$5-15/月**

### CF Workers CPU 时间限制说明

> ⚠️ **重要：爬虫模块需要 Paid Plan**
>
> | 版本 | CPU 时间限制 | 是否支持爬虫 |
> |------|-------------|-------------|
> | **Free Plan** | **10ms / 请求** | ❌ 不支持（单次 Cron 包含多源 fetch + JSON.parse + 去重 + 配对 + 过滤，预计需 50-500ms） |
> | **Paid Plan ($5/月)** | **30s / 请求** | ✅ 支持（CPU 充裕，但建议拆分为多步 Subrequest 或分批处理） |
> | **Paid Plan (可选优化)** | 配合 Durable Objects | ✅ 更优（可突破 30s 单请求限制） |
>
> **MVP 建议**：
> - **v1.0 (MVP)**：不部署爬虫模块，仅使用内置词库 + 手动通过 Admin API 刷新，Free Plan 即可
> - **v1.1 (在线词库)**：启用爬虫 Cron 任务时，需升级至 Paid Plan（$5/月）；或替代方案为使用 GitHub Actions 定时爬取 + 推送 KV，Worker 仅提供 API 读取
>
> **各步骤 CPU 时间预估（参考）**：
>
> | 步骤 | 预估 CPU 耗时 | 说明 |
> |------|-------------|------|
> | GitHub fetch + JSON.parse | 5-20ms | 取决于词库大小 |
> | 多源并行 fetch | 20-50ms | 2-3 个源并行 |
> | 去重 + 合并 | 5-20ms | O(n) 遍历 |
> | 词条配对算法 | 10-30ms | 模板匹配 |
> | 敏感词过滤 | 5-15ms | 正则扫描 |
> | 序列化写入 KV | 10-30ms | 取决于数据量 |
> | **总计** | **~55-165ms** | **远超 Free Plan 10ms 限额** |

---

## 附录 D: 开发里程碑与架构交付物对照

| 阶段 | 时间 | 架构涉及模块 | 产出 |
|------|------|------------|------|
| Sprint 1 (W1-2) | 前端骨架 | §2 目录结构 + §2.3 组件层级 + §5.2 GameState + §9.1 发牌算法 | 可运行原型 |
| Sprint 2 (W3) | 前端交互 | §2.4 状态机 + §2.5 路由方案 + §9.4 防偷看 | 完整前端流程 |
| Sprint 3 (W4) | 前端打磨 | §8.1 性能目标 + §8.4 安全措施 | MVP 发布 |
| Sprint 4 (W5-6) | 后端 API | §3 Worker 结构 + §3.2 API 路由 + §6 词库保护 | 在线词库可用 |
| Sprint 5 (W5-6) | 爬虫模块 | §4 数据源 + §4.3 配对算法 + §4.4 过滤 | 每日自动更新 |
| Sprint 6 (W7) | 集成测试 | §7 部署 + §8.2 API 性能 + §8.3 缓存 | v1.1 发布 |

---

*架构文档编写：Architect Agent 🏗️*
*基于：调研报告 v2.0 + PRD v1.0 + 原型设计 v1.0*
*完成时间：2026-04-26 01:48 CST*
*修订时间：2026-04-26 02:34 CST（根据评审报告修复 Critical + High 问题）*
*下一步：Gate 2 最终审批 → 开发实施*

---

## 附录 E: 原型修正记录

> ### C-01：原型 JS 语法错误修正说明
>
> **问题位置**：prototype.md（原型文件）中游戏结束页代码
>
> **错误写法**：
> ```javascript
> document.getElementById('summary-words')textContent = state.currentPair
> //                                    ^^^^ 缺少点号操作符
> ```
>
> **正确写法**：
> ```javascript
> document.getElementById('summary-words').textContent = state.currentPair
> ```
>
> **影响范围**：游戏结束页（RevealScreen）显示词对信息的功能
> **修复要求**：编码阶段实现 RevealScreen 组件时必须使用正确的 `.textContent` 属性访问语法