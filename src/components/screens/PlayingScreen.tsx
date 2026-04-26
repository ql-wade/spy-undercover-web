import { useMemo } from 'react'
import { useGameStore, selectAlivePlayers } from '../../store/useGameStore'
import { Container } from '../layout/Container'
import { Header } from '../layout/Header'
import { Button } from '../ui/Button'
import { GameTimer } from '../game/GameTimer'

/**
 * 描述阶段页面（Sprint 3: 性能优化）
 *
 * 使用 selectAlivePlayers 预构建选择器
 */
export function PlayingScreen() {
  // === 细粒度状态订阅 ===
  const currentSpeakerIndex = useGameStore((s) => s.currentSpeakerIndex)
  const currentRound = useGameStore((s) => s.currentRound)
  const config = useGameStore((s) => s.config)
  const nextSpeaker = useGameStore((s) => s.nextSpeaker)
  const startVoting = useGameStore((s) => s.startVoting)

  // 使用预构建选择器获取存活玩家
  const alivePlayers = useGameStore(selectAlivePlayers)
  // 🔒 边界保护：淘汰玩家后 alivePlayers 缩小，防止索引越界
  const currentSpeaker = alivePlayers[Math.min(currentSpeakerIndex, alivePlayers.length - 1)]

  // 缓存计算：是否最后一位发言者
  const isLastSpeaker = useMemo(
    () =>
      currentSpeakerIndex >= alivePlayers.length - 1 &&
      currentRound >= config.descriptionRounds,
    [currentSpeakerIndex, alivePlayers.length, currentRound, config.descriptionRounds]
  )

  return (
    <Container>
      <Header
        title="描述阶段"
        subtitle={`第 ${currentRound}/${config.descriptionRounds} 轮`}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {/* 当前发言者信息 */}
        <div className="w-full text-center space-y-4">
          {/* 轮次指示器 */}
          <div className="flex items-center justify-center gap-2">
            {alivePlayers.map((_, idx) => (
              <div
                key={idx}
                className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                  idx === currentSpeakerIndex
                    ? 'bg-primary scale-125'
                    : idx < currentSpeakerIndex
                    ? 'bg-success'
                    : 'bg-text-muted/30'
                }`}
              />
            ))}
          </div>

          {/* 发言者卡片 */}
          <div className="bg-surface-dark rounded-radius-card p-8 mx-auto max-w-sm">
            <p className="text-text-muted text-sm mb-2">当前发言者</p>
            <p className="text-3xl font-black">
              {currentSpeaker?.name ?? '未知'}
            </p>
            <p className="text-text-muted text-sm mt-2">
              第 {currentSpeakerIndex + 1}/{alivePlayers.length} 位
            </p>
          </div>

          {/* 计时器（可选） */}
          {config.timerEnabled && (
            <GameTimer initialSeconds={config.timerSeconds} isRunning />
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="p-4 space-y-3 border-t border-white/5">
        {!isLastSpeaker ? (
          <Button variant="primary" size="lg" fullWidth onClick={nextSpeaker}>
            下一位发言 →
          </Button>
        ) : (
          <Button variant="danger" size="lg" fullWidth onClick={startVoting}>
            🗳️ 开始投票
          </Button>
        )}

        {/* 存活玩家列表 */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          {alivePlayers.map((p, idx) => (
            <div
              key={p.id}
              className={`text-center py-2 rounded-lg text-xs font-medium ${
                idx === currentSpeakerIndex
                  ? 'bg-primary text-white'
                  : 'bg-surface-dark text-text-secondary'
              }`}
            >
              P{p.id}
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}
