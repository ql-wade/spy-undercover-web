import { useMemo, useCallback } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { Container } from '../layout/Container'
import { Header } from '../layout/Header'
import { VotePanel } from '../game/VotePanel'

/**
 * 投票页面（Sprint 3: 性能优化）
 *
 * - 细粒度状态订阅
 * - useMemo 缓存投票统计
 */
export function VotingScreen() {
  // === 细粒度状态订阅 ===
  const players = useGameStore((s) => s.players)
  const voteResults = useGameStore((s) => s.voteResults)
  const votingTarget = useGameStore((s) => s.votingTarget)
  const setVotingTarget = useGameStore((s) => s.setVotingTarget)
  const castVote = useGameStore((s) => s.castVote)
  const processVoteResult = useGameStore((s) => s.processVoteResult)

  // 缓存：排序后的投票条目（避免每次渲染重新排序）
  const sortedVoteEntries = useMemo(
    () =>
      Object.entries(voteResults)
        .sort(([, a], [, b]) => b - a)
        .map(([pid, votes]) => ({ pid: Number(pid), votes })),
    [voteResults]
  )

  // 缓存：最大票数（用于进度条宽度计算）
  const maxVotes = useMemo(
    () => Math.max(...Object.values(voteResults), 1),
    [voteResults]
  )

  const handleConfirmVote = useCallback(() => {
    if (votingTarget !== null) {
      castVote(votingTarget)
      processVoteResult()
    }
  }, [votingTarget, castVote, processVoteResult])

  return (
    <Container>
      <Header title="投票环节" subtitle="选择你认为是卧底的玩家" />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <VotePanel
          players={players}
          voteResults={voteResults}
          selectedTarget={votingTarget}
          onSelectTarget={setVotingTarget}
          onConfirmVote={handleConfirmVote}
        />
      </div>

      {/* 投票统计摘要 */}
      {sortedVoteEntries.length > 0 && (
        <div className="p-4 border-t border-white/5">
          <h3 className="text-sm text-text-secondary mb-2">当前票数</h3>
          <div className="space-y-1">
            {sortedVoteEntries.map(({ pid, votes }) => {
              const player = players.find((p) => p.id === pid)
              return (
                <div key={pid} className="flex items-center gap-2 text-sm">
                  <span className="text-text-secondary w-16 truncate">
                    {player?.name ?? `玩家 ${pid}`}
                  </span>
                  <div className="flex-1 h-2 bg-surface-dark rounded-full overflow-hidden">
                    <div
                      className="h-full bg-danger rounded-full transition-all duration-300"
                      style={{ width: `${(votes / maxVotes) * 100}%` }}
                    />
                  </div>
                  <span className="text-danger font-bold w-8 text-right tabular-nums">
                    {votes}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Container>
  )
}
