import { useState, useMemo, useCallback } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { Container } from '../layout/Container'
import { Header } from '../layout/Header'
import { Button } from '../ui/Button'
import { Stepper } from '../ui/Stepper'
import { SegmentedControl } from '../ui/SegmentedControl'

/**
 * 设置页面（Sprint 3: 性能优化）
 *
 * - useMemo 缓存约束计算和角色预览
 * - useCallback 稳定事件处理
 */
export function SetupScreen() {
  const config = useGameStore((s) => s.config)
  const setConfig = useGameStore((s) => s.setConfig)

  // 本地状态（用户确认前不写入 store）
  const [playerCount, setPlayerCount] = useState(config.playerCount)
  const [spyCount, setSpyCount] = useState(config.spyCount)
  const [blankCount, setBlankCount] = useState(config.blankCount)
  const [gameMode, setGameMode] = useState(config.gameMode)
  const [difficulty, setDifficulty] = useState(config.difficulty)
  const [descriptionRounds, setDescriptionRounds] = useState(config.descriptionRounds)

  // === 缓存：约束校验 ===
  const constraints = useMemo(() => {
    const maxSpy = playerCount <= 5 ? 1 : 2
    const maxBlank = Math.floor((playerCount - spyCount - 1) / 2)
    const civilian = playerCount - spyCount - blankCount
    return {
      maxSpy,
      maxBlank,
      civilianCount: civilian,
      hasError: civilian < 1,
    }
  }, [playerCount, spyCount, blankCount])

  // 缓存：角色预览文本
  const rolePreview = useMemo(() => {
    const parts: string[] = []
    if (constraints.civilianCount > 0) parts.push(`${constraints.civilianCount} 平民`)
    if (spyCount > 0) parts.push(`${spyCount} 卧底`)
    if (blankCount > 0) parts.push(`${blankCount} 白板`)
    return parts.join(' vs ')
  }, [constraints.civilianCount, spyCount, blankCount])

  // === 稳定的事件处理函数 ===
  const handleStart = useCallback(() => {
    if (constraints.hasError) return

    // 写入配置到 store
    setConfig({
      playerCount,
      spyCount,
      blankCount,
      gameMode,
      difficulty,
      descriptionRounds,
    })

    // 切换到 dealing phase
    useGameStore.setState({ phase: 'dealing' })
  }, [constraints.hasError, playerCount, spyCount, blankCount, gameMode, difficulty, descriptionRounds, setConfig])

  const handlePlayerCountChange = useCallback(
    (val: number) => {
      setPlayerCount(val)
      // 自动调整超范围的卧底/白板数
      if (val <= 5 && spyCount > 1) setSpyCount(1)
      if (blankCount > Math.floor((val - spyCount - 1) / 2)) {
        setBlankCount(Math.max(0, Math.floor((val - spyCount - 1) / 2)))
      }
    },
    [spyCount, blankCount]
  )

  const handleModeChange = useCallback(
    (val: string) => {
      setGameMode(val as 'classic' | 'whiteboard')
      if (val === 'whiteboard' && blankCount === 0) {
        setBlankCount(1)
      }
    },
    [blankCount]
  )

  return (
    <Container>
      <Header title="游戏设置" subtitle="配置游戏参数" />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 模式选择 */}
        <section>
          <h2 className="text-sm font-medium text-text-secondary mb-2">
            游戏模式
          </h2>
          <SegmentedControl
            options={[
              { value: 'classic' as const, label: '经典模式' },
              { value: 'whiteboard' as const, label: '白板模式' },
            ]}
            value={gameMode}
            onChange={handleModeChange}
          />
        </section>

        {/* 玩家配置 */}
        <section className="space-y-4 bg-surface-dark rounded-radius-card p-4">
          <h2 className="text-sm font-medium text-text-secondary">
            玩家配置
          </h2>

          <Stepper
            label="玩家人数"
            value={playerCount}
            min={4}
            max={12}
            onChange={handlePlayerCountChange}
          />

          <Stepper
            label="卧底数量"
            value={spyCount}
            min={1}
            max={constraints.maxSpy}
            onChange={setSpyCount}
          />

          {(gameMode === 'whiteboard' || blankCount > 0) && (
            <Stepper
              label="白板数量"
              value={blankCount}
              min={0}
              max={Math.min(2, constraints.maxBlank)}
              onChange={setBlankCount}
            />
          )}
        </section>

        {/* 角色预览 */}
        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-dark rounded-radius-card">
          <span className="text-text-muted text-sm">📊</span>
          <span className="font-semibold">{rolePreview}</span>
        </div>

        {constraints.hasError && (
          <p className="text-danger text-sm text-center">
            ⚠️ 配置无效：平民数量不足，请调整参数
          </p>
        )}

        {/* 词库设置 */}
        <section className="space-y-4 bg-surface-dark rounded-radius-card p-4">
          <h2 className="text-sm font-medium text-text-secondary">
            词库设置
          </h2>

          <SegmentedControl
            options={[
              { value: 'random' as const, label: '随机' },
              { value: 'easy' as const, label: '简单' },
              { value: 'medium' as const, label: '中等' },
              { value: 'hard' as const, label: '困难' },
            ]}
            value={difficulty}
            onChange={(val) => setDifficulty(val)}
          />

          <Stepper
            label="描述轮次"
            value={descriptionRounds}
            min={1}
            max={3}
            onChange={setDescriptionRounds}
          />
        </section>
      </div>

      {/* 底部按钮 */}
      <div className="p-4 border-t border-white/5">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={constraints.hasError}
          onClick={handleStart}
        >
          🎮 开始发牌！
        </Button>
      </div>
    </Container>
  )
}
