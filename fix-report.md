# 修复报告

> **项目**：谁是卧底 Web 版（spy-undercover）
> **修复日期**：2026-04-26
> **基于评审**：review-report.md
> **修复范围**：🔴 Critical × 1 + 🟡 High × 6（代码级问题，不含架构缺失模块）

---

## 修复总览

| # | 级别 | 问题 | 状态 | 涉及文件 |
|---|------|------|------|----------|
| C1 | 🔴 Critical | `nextSpeaker` / `PlayingScreen` 索引越界风险 | ✅ 已修复 | `store/useGameStore.ts`, `components/screens/PlayingScreen.tsx` |
| H1 | 🟡 High | 发牌逻辑重复（DRY 违规） | ✅ 已修复 | `utils/dealing.ts`, `hooks/useGameLogic.ts`, `components/screens/DealingScreen.tsx` |
| H2 | 🟡 High | PlayerCard 未使用 useAntiPeek（防偷看不一致） | ✅ 已修复 | `components/game/PlayerCard.tsx` |
| H3 | 🟡 High | API 缺少 L2 localStorage 持久化缓存 | ✅ 已修复 | `services/wordApi.ts` |
| H4 | 🟡 High | `submitVote` 硬编码 voterId=0，语义不清 | ✅ 已修复 | `store/useGameStore.ts`, `hooks/useGameLogic.ts`, `components/screens/VotingScreen.tsx` |
| H7a | 🟡 High | `saveLastConfig` 浅拷贝风险 | ✅ 已修复 | `store/useSettingsStore.ts` |

**TypeScript 编译**：✅ 零错误通过 (`tsc --noEmit`)

---

## 详细修复内容

### C1 🔴 `nextSpeaker` / `PlayingScreen` 索引越界风险

**问题**：淘汰玩家后 `alivePlayers` 数组缩小，但 `currentSpeakerIndex` 可能指向超出范围的索引，导致 `alivePlayers[currentSpeakerIndex]` 返回 `undefined`，显示"未知"玩家名。

**修复点 A — `store/useGameStore.ts` 的 `nextSpeaker()`**：
```diff
  nextSpeaker: () => {
    const { players, currentSpeakerIndex, currentRound, config } = get()
    const alivePlayers = players.filter((p) => p.isAlive)
+   // 🔒 边界保护：淘汰玩家后 alivePlayers 缩小，确保索引不越界
+   const safeIndex = Math.min(currentSpeakerIndex, Math.max(alivePlayers.length - 1, 0))
-   const nextIdx = currentSpeakerIndex + 1
+   const nextIdx = safeIndex + 1
```

**修复点 B — `components/screens/PlayingScreen.tsx` 渲染时**：
```diff
- const currentSpeaker = alivePlayers[currentSpeakerIndex]
+ // 🔒 边界保护：淘汰玩家后 alivePlayers 缩小，防止索引越界
+ const currentSpeaker = alivePlayers[Math.min(currentSpeakerIndex, alivePlayers.length - 1)]
```

---

### H1 🟡 发牌逻辑重复

**问题**：`useGameLogic.startNewGame()` 和 `DealingScreen.useEffect()` 中存在几乎相同的发牌代码（获取词对 → dealCards → 写入 store），违反 DRY 原则。

**修复方案**：在 `utils/dealing.ts` 中提取 `executeDeal()` 统一发牌入口函数：

```typescript
// utils/dealing.ts 新增
export function executeDeal(config: {
  playerCount: number
  spyCount: number
  blankCount: number
  difficulty?: 'easy' | 'medium' | 'hard' | 'random'
}): { players: Player[]; wordPair: WordPair } {
  const wordPair = getRandomWordPair(config.difficulty)
  const players = dealCards(config.playerCount, config.spyCount, config.blankCount, wordPair)
  return { players, wordPair }
}
```

**修改的调用方**：
- `hooks/useGameLogic.ts` — `startNewGame()` 改为调用 `executeDeal()`
- `components/screens/DealingScreen.tsx` — `useEffect` 和 `handleRedeal` 改为调用 `executeDeal()`

---

### H2 🟡 PlayerCard 未使用 useAntiPeek

**问题**：PlayerCard 自行用 `useState` + `isBlurred` 实现模糊/显示逻辑，与 WordDisplay 组件（正确使用 useAntiPeek Hook）行为不一致。且 WordDisplay 成为死代码。

**修复**：移除 PlayerCard 中的自定义 blur 状态和 `toggleBlur` 回调，将词语显示区域替换为 `<WordDisplay>` 组件：

```tsx
// 替换前：~40 行自定义 blur 逻辑（useState + toggleBlur + 手动事件绑定）
// 替换后：
{/* 词语显示（使用 WordDisplay 统一防偷看） */}
<WordDisplay word={player.word} role={player.role} />
```

**效果**：
- ✅ 统一防偷看行为（3 秒自动重模糊）
- ✅ 消除 ~30 行重复代码
- ✅ WordDisplay 不再是死代码

---

### H3 🟡 API 缺少 L2 localStorage 持久化缓存

**问题**：架构设计 §8.3 要求 L2 localStorage 缓存层，当前仅实现 L1 内存 Map 缓存，刷新页面即丢失。

**修复**：在 `services/wordApi.ts` 中添加完整的 L2 缓存体系：

| 函数 | 作用 |
|------|------|
| `getL2Cached(key)` | 从 localStorage 读取缓存条目（含 TTL 过期检查） |
| `setL2Cache(key, data)` | 写入 localStorage 持久化 |
| `warmupL1FromL2()` | 应用启动时从 L2 预热 L1 内存缓存 |

**集成方式**：
- `getCached()` → L1 未命中时回退查 L2，L2 命中则回填 L1
- `setCache()` → 写入 L1 后同步写入 L2
- 所有 API 操作透明受益，无需改动调用方

---

### H4 🟡 `submitVote` 硬编码 voterId=0

**问题**：`castVote(_voterId, targetId)` 中 voterId 被下划线忽略，`submitVote` 硬编码传 `0`，语义不清。

**修复**：
- `store/useGameStore.ts`：接口签名简化为 `castVote(targetId: number)`，添加注释说明单设备设计意图
- `hooks/useGameLogic.ts`：`submitVote(targetId)` 改为 `store.castVote(targetId)`
- `components/screens/VotingScreen.tsx`：同步更新调用参数

---

### H7a 🟡 `saveLastConfig` 浅拷贝风险

**问题**：`{ ...config }` 浅拷贝在当前全原始类型结构下安全，但未来扩展嵌套对象时有隐患。

**修复**：改用 `structuredClone(config)` 并添加防御性注释。

---

## 未修复项（架构缺口，非代码 bug）

以下 High 级别问题是**架构规划模块未实现**，不属于代码缺陷修复范畴，建议后续迭代补齐：

| # | 问题 | 建议 |
|---|------|------|
| H5 | 4 个架构 Hook 未实现（useTimer/useMediaQuery/usePreventLeave/useKeyboardNav） | 按优先级逐个补齐，usePreventLeave 最重要 |
| H6 | 3 个 UI 组件未实现（Modal/Toast/ProgressDots/Countdown/Toggle） | 按需实现 |
| H7b | PWA 未配置（vite-plugin-pwa） | 添加依赖 + 配置 |

---

## 修改文件清单

| 文件 | 修改类型 |
|------|----------|
| `src/store/useGameStore.ts` | C1 边界保护 + H4 castVote 签名简化 |
| `src/components/screens/PlayingScreen.tsx` | C1 渲染边界保护 |
| `src/utils/dealing.ts` | H1 新增 executeDeal 统一入口 |
| `src/hooks/useGameLogic.ts` | H1 使用 executeDeal + H4 单参数 castVote |
| `src/components/screens/DealingScreen.tsx` | H1 使用 executeDeal（useEffect + handleRedeal） |
| `src/components/game/PlayerCard.tsx` | H2 集成 WordDisplay 组件 |
| `src/services/wordApi.ts` | H3 L2 localStorage 缓存体系 |
| `src/store/useSettingsStore.ts` | H7a structuredClone |
| `src/components/screens/VotingScreen.tsx` | H4 同步 castVote 参数更新 |

**共 9 个文件修改，TypeScript 编译零错误。**
