import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { cx } from '@/components/ui'
import { CardImage } from '@/components/cards/CardVisuals'
import { api } from '@/lib/api'
import { dateTime, relative } from '@/lib/format'
import type { Notification } from '@/lib/types'

/** One notification row. Favourite-Pokémon alerts get the card image and a highlighted look. */
export function NotificationItem({ n, onRead, compact }: { n: Notification; onRead(): void; compact?: boolean }) {
  const fav = n.kind === 'favorite'
  return (
    <Link
      to={n.link || '/notificacoes'}
      onClick={() => !n.read_at && void api.markRead([n.id]).then(onRead)}
      className={cx(
        'group flex gap-3 rounded-2xl transition-colors',
        compact ? 'px-3 py-3' : 'p-4 sm:p-5',
        fav ? 'bg-gold-soft/70 hover:bg-gold-soft' : !n.read_at && !compact ? 'bg-accent-soft/40 hover:bg-surface-2' : 'hover:bg-surface-2',
      )}
    >
      {fav && n.image_path ? (
        <span className="relative shrink-0">
          <CardImage path={n.image_path} alt="" className={cx('aspect-[5/7] rounded-lg ring-1 ring-gold/40', compact ? 'w-10' : 'w-12')} />
          <span aria-hidden className="absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-full bg-gold text-[#2b1d00] ring-2 ring-bg">
            <Heart className="size-3 fill-current" />
          </span>
        </span>
      ) : (
        <span aria-hidden className={cx('mt-2 size-2 shrink-0 rounded-full', n.read_at ? 'bg-line-strong' : 'bg-accent')} />
      )}
      <span className="min-w-0 flex-1">
        <span className={cx('block leading-snug font-semibold', fav && 'text-gold-text')}>
          {n.title}
          {!n.read_at && <span className="sr-only"> (não lida)</span>}
        </span>
        {n.body && <span className={cx('block text-muted', compact ? 'line-clamp-2 text-sm' : 'text-[15px]')}>{n.body}</span>}
        {compact && <span className="mt-0.5 block text-xs text-subtle">{relative(n.created_at)}</span>}
      </span>
      {!compact && (
        <time dateTime={n.created_at} title={dateTime(n.created_at)} className="shrink-0 text-[13px] text-subtle">
          {relative(n.created_at)}
        </time>
      )}
    </Link>
  )
}
