# 代码评审报告

> **项目**：谁是卧底 Web 版（spy-undercover）
> **评审日期**：2026-04-26
> **评审范围**：前端源码 `src/` 全部文件 + 配置文件 + 架构文档对照
> **技术栈**：React 18 + Vite 6 + Zustand 4.5 + TailwindCSS 4 + TypeScript 5.6

---

## 总体评价

**质量评分：⭐⭐⭐⭐☆（4.0 / 5.0）**

### 总结

项目整体**架构清晰、代码质量较高**，体现了良好的工程实践。状态机驱动的路由方案适合游戏线性流程场景；Zustand Store 设计合理，细粒度选择器有效避免不必要的重渲染；安全措施较为完善（CSP meta 标签、XSS 防护函数、输入校验）；性能优化意识强（React.memo、useMemo、useCallback、React.lazy 代码分割、手动 chunk 分离）。

主要扣分点：（1）部分架构文档规划的模块未实现（4 个 Hook 缺失、3 个 UI 组件缺失、PWA 未配置）；（2）存在一处逻辑缺陷可能导致投票异常；（3）防偷看机制实现不一致。

---

## 逐文件评审

### 入口与配置

#### `main.tsx`
- ✅ 标准 React 18 入口，使用 `StrictMode`
- ✅ 无问题

#### `index.html`
- ✅ 完整的安全 Meta 标签集合（CSP、X-Frame-Options、X-XSS-Protection、Referrer-Policy、Permissions-Policy）
- ✅ 视口禁止缩放（适配移动端游戏场景）
- ✅ noscript 降级提示
- ✅ DNS prefetch / preconnect 性能优化
- ⚠️ CSP 中 `connect-src` 允许 `https://*.workers.dev` 通配符子域，建议收敛到具体域名

#### `vite.config.ts`
- ✅ esbuild `drop` 生产环境移除 console/debugger
- ✅ 手动 chunk 分割（vendor-react / vendor-state）
- ✅ ES2020 目标，减少 polyfill
- ✅ chunk 大小警告阈值 60KB
- ⚠️ `@` 别名已配置但代码中未使用（全部用相对路径），不影响功能但别名形同虚设

#### `tsconfig.json`
- ✅ `strict: true` 开启严格模式
- ✅ `noUnusedLocals` + `noUnusedParameters` 防止死代码
- ✅ `noUncheckedIndexedAccess` 增强类型安全
- ✅ `noFallthroughCasesInSwitch` 防止 switch 穿透

#### `package.json`
- ✅ 依赖精简，无冗余包
- ✅ 架构设计的 Framer Motion 未引入（用 CSS 动画替代，减少 bundle 体积）—— **合理的简化决策**
- ⚠️ 缺少 `biome` 和 `vite-plugin-pwa` 依赖（架构文档要求）

---

### 类型定义

#### `types/game.ts`
- ✅ 类型定义完整，覆盖游戏全流程
- ✅ `ApiResponse<T>` 泛型设计良好
- ✅ `winner` 类型包含 `'blank'`（架构文档最初版本遗漏，代码已修正）
- ✅ API 响应类型分拆为 `WordsResponse`、`RandomWordsResponse`、`TodayWordsResponse`
- 💡 建议：`WordPair.id` 类型可改为 ` branded type`（如 `type WordId = string & { __brand: 'WordId' }`）防止与其他字符串混淆（Low 优先级）

---

### 状态管理

#### `store/useGameStore.ts`
- ✅ Store 接口设计完整，覆盖所有状态机和操作
- ✅ `determineWinner` 导出为纯函数，可独立测试
- ✅ 非法状态转换有 `console.warn` 保护（不抛异常，保证健壮性）
- ✅ 提供预构建选择器 `selectCurrentPlayer`、`selectAlivePlayers`、`selectRevealedCount`
- ✅ `processVoteResult` 正确处理平局（不淘汰，继续游戏）和游戏结束（直接跳 reveal）

- 🔴 **Critical：`nextSpeaker` 存在索引越界风险**

  当玩家被淘汰后，`currentSpeakerIndex` 可能指向超出 `alivePlayers` 数组范围的索引。例如：5 人游戏中第 3 位玩家被淘汰后，`alivePlayers` 变为 4 个元素，但 `currentSpeakerIndex` 可能为 3（原第 4 位存活玩家的位置映射不正确）。`PlayingScreen` 中 `alivePlayers[currentSpeakerIndex]` 可能返回 `undefined`（虽然有 `??` 兜底显示"未知"，但逻辑不正确）。

  **建议修复**：在 `nextSpeaker` 和 `continueGame` 重置时，校验 `currentSpeakerIndex` 不超过 `alivePlayers.length - 1`。

- 🟡 **High：`castVote` 的 `_voterId` 参数被忽略**

  `castVote(_voterId: number, targetId: number)` 中 voterId 被前缀下划线标记忽略，`useGameLogic.submitVote` 硬编码传 `0`。单设备模式下这可以工作（轮流操作），但语义不清晰，且如果未来扩展多设备会成隐患。建议改为 `castVote(targetId: number)` 或添加注释说明单设备设计意图。

---

#### `store/useSettingsStore.ts`
- ✅ 使用 Zustand `persist` 中间件自动持久化
- ✅ `partialize` 明确指定持久化字段
- ✅ 默认主题为 `dark`（匹配设计）
- 🟡 **High：`saveLastConfig` 使用浅拷贝 `{ ...config }`**

  如果 `GameConfig` 未来嵌套对象增加，浅拷贝可能造成状态污染。当前结构都是原始类型所以安全，但建议加注释说明或改用 `structuredClone`。

---

### Hooks

#### `hooks/useAntiPeek.ts`
- ✅ 实现清晰：blur → 显示 → timeout → 自动重模糊
- ✅ `useEffect` 清理定时器防止内存泄漏
- ✅ 支持 `autoReblur` 配置项
- ✅ `useCallback` 稳定引用
- 无问题

#### `hooks/useGameLogic.ts`
- ✅ 完整封装了游戏全流程操作
- 🟡 **High：发牌逻辑与 `DealingScreen` 重复**

  `startNewGame` 和 `DealingScreen` 的 `useEffect` 中存在几乎相同的发牌逻辑（获取词对 → dealCards → 写入 store）。这违反 DRY 原则，且可能导致行为不一致。

  **建议**：将发牌逻辑统一到 `useGameLogic.startNewGame`，`DealingScreen` 调用 `startNewGame` 而不是自己实现。

- 🟡 **High：`submitVote` 硬编码 voterId 为 0**

  同上所述，`store.castVote(0, targetId)` 在多轮投票中都传 0，意味着无法区分谁投的票。虽然当前单设备模式功能正确，但不利于调试日志和未来扩展。

#### `hooks/useWordBank.ts`
- ✅ 内置词库即时可用，在线词库异步增量补充
- ✅ 在线词库失败优雅降级（不阻塞主流程）
- ✅ 今日词加载失败独立 catch，不影响主词库
- ✅ `getRandomPair` 委托给 builtinWords 函数
- ⚠️ 合并在线词时使用 `Set<string>` 去 ID 重去重，但如果在线词库返回的词对 ID 与内置词库不同但内容相同，仍可能重复（Low 风险）

---

### 服务层

#### `services/wordApi.ts`
- ✅ 内存缓存 + TTL 过期机制
- ✅ 请求去重（防止并发重复请求）
- ✅ 统一错误处理（`ApiError` 类 + `handleResponse`）
- ✅ `NO_WORDS_TODAY` 优雅降级返回空结果
- ✅ `fetchHealth` 失败兜底返回 offline 状态
- ✅ 缓存统计 API（开发调试用）
- 🟡 **High：缓存使用内存 Map，页面刷新即丢失**

  架构文档 §8.3 设计了 L2 localStorage 缓存，但代码中仅实现了 L1 内存缓存（Map）。刷新页面后缓存全部丢失，需要重新请求 API。

  **建议**：在内存缓存命中时同步写入 localStorage，应用启动时从 localStorage 恢复热数据。

- ⚠️ `cacheHits` / `cacheMisses` 是模块级可变全局变量，在严格意义上不是纯函数式，但在 SPA 场景下实际无影响

---

### 工具函数

#### `utils/dealing.ts`
- ✅ Fisher-Yates 洗牌算法正确实现
- ✅ 完善的参数校验（RangeError + 边界检查）
- ✅ 角色分配逻辑正确
- ✅ 5 人以下限制最多 1 卧底的规则
- ✅ 白板数量上限计算合理
- 无问题

#### `utils/perf.ts`
- ✅ `memoNamed` 高阶组件封装实用
- ✅ User Timing API 仅开发模式启用
- ✅ debounce 工具函数
- ⚠️ 当前项目中 `memoNamed` 和 `debounce` 似乎未被任何组件导入使用（死代码）

#### `utils/security.ts`
- ✅ `escapeHtml` 覆盖所有关键 HTML 实体
- ✅ `sanitizeText` 移除控制字符
- ✅ `isValidWord` 正则校验（中文/英文/数字/标点）
- ✅ CSP Header 值完整
- ✅ 安全头配置齐全
- ✅ `maskWord` 脱敏工具
- ✅ 所有文本渲染均使用 JSX 文本插值（非 innerHTML），XSS 天然免疫
- 无问题

#### `lib/cn.ts`
- ✅ clsx + twMerge 标准组合模式
- 无问题

---

### 数据

#### `data/builtin-words.ts`
- ✅ 34 组词对覆盖 easy/medium/hard 三档
- ✅ 结构化 id / category / difficulty 字段
- ✅ `getRandomWordPair` 带 fallback 兜底
- ⚠️ 词对数量 34 组偏少（架构规划 200+），MVP 可接受但标注应更新
- 💡 `Math.random()` 非加密安全随机数，但对游戏场景足够（不需要 crypto.getRandomValues）

---

### 组件 — 布局

#### `components/layout/Container.tsx`
- ✅ React.memo 包装
- ✅ max-w-[430px] 移动端优先居中布局
- ✅ min-h-dvh 全屏高度
- 无问题

#### `components/layout/Header.tsx`
- ✅ React.memo 包装
- ✅ 支持返回按钮、副标题、右侧操作区
- ✅ 语义化 `<header>` 标签
- 无问题

---

### 组件 — 屏幕（Screens）

#### `App.tsx`
- ✅ 状态机分发器模式清晰
- ✅ idle/setup 合并显示 SetupScreen（首页 = 设置页，合理简化）
- ✅ VoteResultScreen / RevealScreen 使用 React.lazy 懒加载
- ✅ Suspense 边界 + 自定义 fallback
- ✅ 未知 phase 兜底显示
- ✅ CSS 动画替代 Framer Motion（减少依赖）
- ✅ `VALID_PHASES` 常量 + `useMemo` 缓存合法性检查
- 无问题

#### `screens/SetupScreen.tsx`
- ✅ 本地状态（编辑中）与 Store 状态（确认后写入）分离，避免半配置提交
- ✅ `useMemo` 缓存约束计算和角色预览
- ✅ `useCallback` 稳定事件处理
- ✅ 自动调整超范围参数（人数变化时自动修正卧底/白板数）
- ✅ 白板模式自动设置至少 1 个白板
- ✅ 错误状态禁用开始按钮
- 无问题

#### `screens/DealingScreen.tsx`
- ✅ 使用预构建选择器 `selectCurrentPlayer`、`selectRevealedCount`
- ✅ 首次进入自动发牌（useEffect）
- ✅ useMemo 缓存导航状态
- 🟡 **High：发牌逻辑与 `useGameLogic.startNewGame` 重复**（详见 useGameLogic 评审）
- ⚠️ `useEffect` 依赖 `[players.length, config, dealCardsAction]` 中 `config` 是对象引用，如果 store 外部修改了 config 引用（虽然当前不会），可能触发意外重新发牌

#### `screens/PlayingScreen.tsx`
- ✅ 使用 `selectAlivePlayers` 选择器
- ✅ 轮次指示器可视化（圆点阵列）
- ✅ 最后一位发言者自动切换到"开始投票"
- ✅ 条件渲染 GameTimer
- 🔴 **Critical：`currentSpeaker` 可能为 undefined 导致显示"未知"**

  当淘汰发生后再进入 playing 阶段（voteResult → continueGame），`currentSpeakerIndex` 未重置到合法范围。如果被淘汰玩家是数组中靠后的位置，`alivePlayers[currentSpeakerIndex]` 可能越界。

  **修复建议**：`continueGame` action 中应确保 `currentSpeakerIndex = 0`（当前已做），但在 `PlayingScreen` 渲染时应加边界保护：

  ```tsx
  const currentSpeaker = alivePlayers[Math.min(currentSpeakerIndex, alivePlayers.length - 1)]
  ```

#### `screens/VotingScreen.tsx`
- ✅ 细粒度状态订阅
- ✅ useMemo 缓存排序投票条目和最大票数
- ✅ 投票统计摘要可视化（进度条）
- ✅ 未选择目标时禁用确认
- 无问题

#### `screens/VoteResultScreen.tsx`
- ✅ 模块级常量提取（ROLE_LABELS、ROLE_COLORS、ROLE_ICONS）
- ✅ useMemo 缓存淘汰信息、存活计数、胜利消息
- ✅ 游戏结束 / 继续游戏双路径 UI
- ✅ 角色颜色编码一致
- 无问题

#### `screens/RevealScreen.tsx`
- ✅ 模块级常量（WINNER_CONFIG、ROLE_LABELS、ROLE_BADGE_STYLES）
- ✅ useMemo 预计算玩家列表数据（含淘汰顺序）
- ✅ 词对揭晓展示
- ✅ "再来一局" + "返回设置"双操作
- 无问题

#### `screens/LazyScreens.tsx`
- ✅ 标准 React.lazy + dynamic import()
- ✅ .then() 默认导出重映射
- 无问题

---

### 组件 — 游戏（Game）

#### `components/game/GameTimer.tsx`
- ✅ React.memo 包装
- ✅ setInterval + 清理函数正确
- ✅ isWarning / isCritical 阈值UI反馈
- ✅ 进度条可视化
- ⚠️ `void reset` 是空操作（reset 函数定义了但从未调用/暴露），IDE 可能警告
- 💡 计时器不支持动态修改 `initialSeconds`（prop 变化时不重新计时），但当前场景不需要

#### `components/game/PlayerCard.tsx`
- ✅ React.memo 包装
- ✅ 3D 翻牌 CSS 动画（perspective + rotateY）
- ✅ compact / 完整双模式
- ✅ 键盘可访问性（Enter/Space 触发翻牌）
- ✅ ARIA 标签完整
- ✅ blur 防偷看（点击词语切换模糊）
- 🟡 **High：PlayerCard 自行实现 blur 逻辑，未复用 `useAntiPeek` Hook**

  项目中有完善的 `useAntiPeek` Hook，但 `PlayerCard` 自己用 `useState` + `isBlurred` 重新实现了一套模糊/显示逻辑。而 `WordDisplay` 组件正确使用了 `useAntiPeek`。这导致：
  1. 行为可能不一致（autoReblur 时间：Hook 默认 3s，Card 无自动重模糊）
  2. 代码重复

  **建议**：PlayerCard 的词语显示区域替换为 `<WordDisplay>` 组件。

#### `components/game/VotePanel.tsx`
- ✅ React.memo 包装
- ✅ useMemo 预计算存活玩家
- ✅ useCallback 稳定选择 handler
- ✅ aria-pressed / aria-label 无障碍支持
- ✅ 选中状态视觉反馈（红框 + 阴影 + 对勾）
- 无问题

#### `components/game/WordDisplay.tsx`
- ✅ React.memo + useAntiPeek 集成
- ✅ 安全文本插值
- ✅ 白板模式处理
- ⚠️ **当前未被任何 Screen 组件导入使用**（死代码）。PlayerCard 用自己的实现替代了它。

---

### 组件 — UI

#### `ui/Button.tsx`
- ✅ 5 种变体（primary/secondary/danger/ghost/outline）
- ✅ 3 种尺寸（sm/md/lg）
- ✅ fullWidth / disabled 支持
- ✅ React.memo 包装
- ✅ ...props 透传保留原生 button 属性
- 无问题

#### `ui/Card.tsx`
- ✅ React.memo + 键盘交互 + role 属性
- 无问题

#### `ui/SegmentedControl.tsx`
- ✅ 泛型组件（`<T extends string>`）
- ✅ role="tablist" + aria-selected 语义化
- ⚠️ 注释解释不用 memo 的原因（onChange 引用不稳定），合理

#### `ui/Stepper.tsx`
- ✅ React.memo 包装
- ✅ min/max 边界钳制
- ✅ aria-label 无障碍
- ✅ disabled 状态视觉反馈
- 无问题

---

### 样式

#### `index.css`
- ✅ TailwindCSS 4 `@import "tailwindcss"` + `@theme` 自定义属性
- ✅ CSS 变量完整（颜色/字体/圆角/阴影）
- ✅ 3D 翻牌动画样式（perspective/card-inner/card-face）
- ✅ `prefers-reduced-motion` 媒体查询支持（无障碍）
- ✅ GPU 加速层（will-change）+ 动画结束后清理
- ✅ focus-visible-only（鼠标隐藏焦点环，键盘保留）
- ✅ secure-no-select 防文字选中
- ✅ 页面切换动画（pageIn/fadeIn keyframes）
- ✅ 滚动条美化
- 无问题

---

## 问题清单（按严重程度）

### 🔴 Critical（必须修复）

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| C1 | **`nextSpeaker` / `PlayingScreen` 索引越界风险**：淘汰玩家后 `currentSpeakerIndex` 可能超出 `alivePlayers` 数组范围，导致当前发言者显示"未知"，且 `isLastSpeaker` 判断错误 | `store/useGameStore.ts` → `nextSpeaker()` + `screens/PlayingScreen.tsx` | 投票淘汰后继续游戏时，描述阶段可能显示错误的玩家或崩溃 |

### 🟡 High（应该修复）

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| H1 | **发牌逻辑重复**：`useGameLogic.startNewGame()` 与 `DealingScreen.useEffect()` 存在几乎相同的发牌代码，违反 DRY 且行为可能不一致 | `hooks/useGameLogic.ts` + `screens/DealingScreen.tsx` | 维护成本高，未来修改发牌逻辑需同步两处 |
| H2 | **PlayerCard 未使用 useAntiPeek**：自行实现 blur 逻辑，与 WordDisplay 行为不一致（缺少自动重模糊），且 WordDisplay 成为死代码 | `components/game/PlayerCard.tsx` | 防偷看体验不一致，代码冗余 |
| H3 | **API 缺少 L2 localStorage 持久化缓存**：架构设计 §8.3 要求 localStorage 作为 L2 缓存层，当前仅实现内存 Map 缓存，刷新即丢失 | `services/wordApi.ts` | 每次刷新都需要重新请求 API，增加延迟和服务器压力 |
| H4 | **`submitVote` 硬编码 voterId=0**：`castVote` 的 voterId 参数被忽略，不利于调试追踪和多设备扩展 | `hooks/useGameLogic.ts` → `submitVote()` | 语义不清，voteResults 无法追溯投票来源 |
| H5 | **4 个架构规划 Hook 未实现**：`useTimer.ts`、`useMediaQuery.ts`、`usePreventLeave.ts`、`useKeyboardNav.ts` | `hooks/` 目录 | 架构符合性缺口（见下方详细分析） |
| H6 | **3 个架构规划 UI 组件未实现**：`Modal.tsx`、`Toast.tsx`、`ProgressDots.tsx`、`Countdown.tsx`、`Toggle.tsx` | `components/ui/` 目录 | 如果后续功能需要这些组件需补齐 |
| H7 | **PWA 未配置**：架构 v1.1 规划 vite-plugin-pwa + Service Worker，当前 package.json 无此依赖 | 配置文件 | 离线不可用，无法添加到主屏幕 |

### 🟢 Low（建议改进）

| # | 问题 | 文件 | 建议 |
|---|------|------|------|
| L1 | **`@` 路径别名未使用**：vite.config.ts 配置了 `@` → `/src` 别名，但全部 import 使用相对路径 | 全部 .ts/.tsx 文件 | 统一使用 `@/` 别名或移除别名配置 |
| L2 | **`perf.ts` 中 `memoNamed` 和 `debudge` 未被导入** | `utils/perf.ts` + 全局搜索 | 删除死代码或在合适的地方使用 |
| L3 | **`GameTimer.void reset` 空操作** | `components/game/GameTimer.tsx` | 移除 reset 函数或通过 ref/forwardRef 暴露 |
| L4 | **内置词库仅 34 组**：架构规划 200+，注释写 "30+ 组 MVP 够用" 但应更新注释或补充词库 | `data/builtin-words.ts` | 补充词库至 100+ 组提升游戏体验 |
| L5 | **CSP connect-src 通配符**：`https://*.workers.dev` 允许所有 workers.dev 子域 | `index.html` | 收敛到具体域名如 `https://api.spy-undercover.workers.dev` |
| L6 | **代码注释中的 Sprint 编号**：多处注释写"Sprint 3: 性能优化"等内部迭代标记 | 多个文件 | 发布前清理为用户友好的注释或移除 |
| L7 | **`security.ts` 导出 CSP 常量但未在运行时使用**：CSP 通过 index.html meta 标签注入，`SECURITY_HEADERS` 对象仅在 CF Pages _headers 场景有用 | `utils/security.ts` | 补充 _headers 文件或标注用途 |
| L8 | **缺少 Error Boundary**：React 组件树无错误边界，任何子组件崩溃会导致白屏 | `App.tsx` 或独立文件 | 添加 class component Error Boundary |
| L9 | **`getRandomWordPair` 使用 `Math.random()`** | `data/builtin-words.ts` | 游戏场景可接受，如需公平性保证可改用 `crypto.getRandomValues` |
| L10 | **目录命名差异**：架构规划 `stores/` → 实现 `store/`，`utils/shuffle.ts` → 合并到 `dealing.ts`，`utils/cn.ts` → `lib/cn.ts`，`styles/theme.css` → 合并到 `index.css` | 目录结构 | 不影响功能，但建议保持一致性或更新架构文档 |

---

## 架构符合性

### ✅ 符合设计的部分

| 架构设计 | 实现状态 | 备注 |
|----------|----------|------|
| React + Vite + Zustand + TailwindCSS4 技术栈 | ✅ 完全符合 | 版本号匹配 |
| 状态机路由（无 React Router） | ✅ 完全符合 | App.tsx phase 分发器 |
| Zustand Store 设计（gameStore + settingsStore） | ✅ 基本符合 | 类型略有调整（winner 含 'blank'） |
| 细粒度选择器 | ✅ 超出预期 | 额外提供了 selectCurrentPlayer/Alive/Revealed |
| 发牌算法（Fisher-Yates + 角色分配） | ✅ 完全符合 | dealing.ts 参数校验完善 |
| 内置词库 fallback 策略 | ✅ 完全符合 | useWordBank 内置→API→降级 |
| 安全措施（CSP/XSS/输入校验） | ✅ 完全符合 | index.html meta + security.ts |
| 性能优化（memo/lazy/code-splitting） | ✅ 超出预期 | 额外加了手动 chunk 分割 |
| CSS 动画替代 Framer Motion | ✅ 合理简化 | 减少 bundle 大小 |
| 组件层级（screens/game/layout/ui） | ✅ 基本符合 | 命名有差异但功能对应 |
| TypeScript strict 模式 | ✅ 完全符合 | tsconfig 配置齐全 |

### ❌ 不符合 / 缺失的部分

| 架构设计 | 实现状态 | 严重程度 | 说明 |
|----------|----------|----------|------|
| `hooks/useTimer.ts` | ❌ 未实现 | 🟡 High | 计时器逻辑封装为 GameTimer 组件而非 Hook |
| `hooks/useMediaQuery.ts` | ❌ 未实现 | 🟢 Low | 当前固定移动端布局，暂不需要响应式断点 |
| `hooks/usePreventLeave.ts` | ❌ 未实现 | 🟡 High | 游戏进行中（dealing/playing/voting）刷新/关闭会导致进度丢失 |
| `hooks/useKeyboardNav.ts` | ❌ 未实现 | 🟢 Low | 已有基本的 keyboard 事件（PlayerCard/VotePanel/Card），但缺少全局导航键 |
| `services/storage.ts`（localStorage 封装） | ❌ 未实现 | 🟡 High | wordApi 缓存和 settingsStore 直接操作 localStorage |
| `ui/Modal.tsx` | ❌ 未实现 | 🟢 Low | 当前无需弹窗交互 |
| `ui/Toast.tsx` | ❌ 未实现 | 🟢 Low | 错误/成功提示可用 alert 替代（不推荐长期） |
| `ui/ProgressDots.tsx` | ❌ 未实现 | 🟢 Low | PlayingScreen 内联了圆点指示器 |
| `ui/Countdown.tsx` | ❌ 未实现 | 🟢 Low | GameTimer 组件替代 |
| `ui/Toggle.tsx` | ❌ 未实现 | 🟢 Low | SetupScreen 中 timerEnabled 设置缺 UI 入口 |
| PWA（vite-plugin-pwa + Service Worker） | ❌ 未配置 | 🟡 High | 离线能力缺失 |
| Biome（lint/format） | ❌ 未配置 | 🟢 Low | 代码风格工具缺失 |
| 内置词库 200+ 组 | ⚠️ 仅 34 组 | 🟡 Medium | MVP 够用但需扩充 |
| Framer Motion AnimatePresence | ⚠️ CSS 替代 | 🟢 Low | 合理的简化决策 |
| `utils/id.ts`（UUID 生成） | ❌ 未实现 | 🟢 Low | Player 使用自增 id，够用 |
| `utils/constants.ts` | ⚠️ 内联到各文件 | 🟢 Low | DEFAULT_CONFIG 在 store 中，约束在 dealing.ts 中 |

### 📊 架构符合度评分

| 维度 | 得分 | 说明 |
|------|------|------|
| 核心架构决策 | 9/10 | ADR-001~006 全部遵循 |
| 目录结构 | 7/10 | 主要模块到位，命名有差异，约 30% 子模块缺失 |
| 状态管理 | 9/10 | Store 设计优秀，选择器粒度好 |
| 组件体系 | 8/10 | 核心 UI 组件齐全，部分辅助组件缺失 |
| Hook 体系 | 6/10 | 3/7 Hook 已实现，关键 Hook（usePreventLeave）缺失 |
| 安全措施 | 9/10 | CSP/XSS/安全头全面覆盖 |
| 性能优化 | 9/10 | memo/lazy/chunk/selectors 全面应用 |
| **综合评分** | **8.0/10** | | |

---

## 总结建议

### 优先级排序（推荐修复顺序）

1. **🔴 立即修复 C1**：`nextSpeaker` + `PlayingScreen` 索引越界（影响核心游戏流程正确性）
2. **🟡 尽快修复 H1**：统一发牌逻辑到 `useGameLogic`，消除 DealingScreen 重复代码
3. **🟡 尽快修复 H2**：PlayerCard 集成 WordDisplay（或 useAntiPeek），统一防偷看行为
4. **🟡 近期修复 H3**：wordApi 添加 localStorage L2 缓存
5. **🟡 近期修复 H7**：添加 `usePreventLeave` Hook（游戏进行中防误刷新）
6. **🟡 近期修复 H7**：配置 PWA（vite-plugin-pwa）
7. **🟢 逐步改进 L1-L10**：代码清理和体验优化

### 整体评价

这是一个**工程质量高于平均水平的 MVP 项目**。代码组织清晰、类型安全严格、性能优化到位、安全意识强。主要问题集中在：（1）一个索引越界 bug 需要修复；（2）部分架构规划的功能模块尚未补齐（属于迭代 completeness 问题而非 quality 问题）；（3）少量代码重复和不一致。

**建议先修复 C1 后即可发布 v1.0**，其余 High/Low 问题可在后续 sprint 中逐步完善。
