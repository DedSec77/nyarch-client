import { classNames, formatScore } from '@/lib/utils'

interface VoteControlProps {
  score: number
  myVote: number
  onVote: (v: -1 | 1) => void
  horizontal?: boolean
  disabled?: boolean
}

export function VoteControl({ score, myVote, onVote, horizontal = false, disabled }: VoteControlProps) {
  return (
    <div
      className={classNames(
        'flex items-center gap-0.5 select-none',
        horizontal ? 'flex-row' : 'flex-col',
      )}
    >
      <button
        disabled={disabled}
        onClick={() => onVote(1)}
        className={classNames(
          'rounded px-1 text-base leading-none transition-colors disabled:opacity-40',
          myVote === 1 ? 'text-neon-green text-glow' : 'text-ink-faint hover:text-neon-green',
        )}
        aria-label="upvote"
      >
        ▲
      </button>
      <span
        className={classNames(
          'min-w-[2ch] text-center text-xs font-bold tabular-nums',
          myVote === 1 ? 'text-neon-green' : myVote === -1 ? 'text-neon-red' : 'text-ink-dim',
        )}
      >
        {formatScore(score)}
      </span>
      <button
        disabled={disabled}
        onClick={() => onVote(-1)}
        className={classNames(
          'rounded px-1 text-base leading-none transition-colors disabled:opacity-40',
          myVote === -1 ? 'text-neon-red text-glow' : 'text-ink-faint hover:text-neon-red',
        )}
        aria-label="downvote"
      >
        ▼
      </button>
    </div>
  )
}
