import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, ArrowLeft, Check, Crown, Gavel, Info, Layers, Minus, Plus, Share2, Trophy, WifiOff, Zap } from 'lucide-react'
import { Page } from '@/components/layout/Page'
import { Mascot } from '@/components/brand/Mascot'
import { Badge, Button, ButtonLink, Checkbox, Countdown, cx, EmptyState, ErrorState, Modal, RollingPrice, Skeleton } from '@/components/ui'
import { CardImage, ComboGallery, ConditionTag, FlipCard, LanguageTag, Lightbox, PokemonChips, type Photo } from '@/components/cards/CardVisuals'
import { LotStatusBadge, lotPhase } from '@/components/auction/LotTile'
import { useAuth, useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { useNowAt } from '@/hooks/useNow'
import { api } from '@/lib/api'
import { checkBid, leadingMinimum } from '@/lib/domain'
import { AppError, toAppError } from '@/lib/errors'
import { conditionLabel, dateLong, dateTime, languageMeta, money, timeOnly, whatsappShare } from '@/lib/format'
import type { BidResult, BoardBid, Lot } from '@/lib/types'

export default function LotDetail() {
  const { id = '' } = useParams()
  const lot = useQuery(`lot:${id}`, () => api.lot(id), { live: { topic: 'lot', id }, poll: 20_000 })
  const board = useQuery(`board:${id}`, () => api.board(id), { live: { topic: 'lot', id }, poll: 20_000 })
  const reload = () => {
    void lot.reload()
    void board.reload()
  }
  if (lot.error) return <Page><ErrorState message={lot.error} onRetry={lot.reload} /></Page>
  if (lot.loading && !lot.data) return <LotSkeleton />
  if (!lot.data) return <Page><EmptyState mascot="confused" title="Lote não encontrado">Ele pode ter sido removido ou ainda não foi publicado.</EmptyState></Page>
  return <LotView lot={lot.data} board={board.data ?? []} boardLoading={board.loading} reload={reload} />
}

function LotSkeleton() {
  return (
    <Page>
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <Skeleton className="aspect-[5/7] max-w-md" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </Page>
  )
}

function LotView({ lot, board, boardLoading, reload }: { lot: Lot; board: BoardBid[]; boardLoading: boolean; reload(): void }) {
  const now = useNowAt([lot.auction?.starts_at, lot.ends_at])
  const phase = lotPhase(lot, lot.auction?.starts_at, now)
  const toast = useToast()
  const [lb, setLb] = useState<number | null>(null)
  const [success, setSuccess] = useState<{ r: BidResult; buyout: boolean } | null>(null)
  const single = lot.kind === 'single' ? lot.cards[0] : null
  const photos: Photo[] = lot.cards.flatMap((c) => [
    { path: c.front_path, alt: `${c.title}, frente`, caption: `${c.title} · frente` },
    { path: c.back_path, alt: `${c.title}, verso`, caption: `${c.title} · verso` },
  ])
  const share = async () => {
    const text = `${lot.title} — lance atual ${money(lot.current_price ?? lot.starting_price)} na Gimmy Cards. ${location.href}`
    if (navigator.share) await navigator.share({ title: lot.title, text, url: location.href }).catch(() => {})
    else window.open(whatsappShare(text), '_blank', 'noopener')
  }
  // When the official end passes, ask the server to close (idempotent) and refresh.
  const onEnd = () => {
    void api.nudgeClose().then(() => setTimeout(reload, 400))
    toast({ kind: 'info', title: 'Horário de encerramento atingido', body: 'Novos lances não são mais aceitos.' })
  }

  return (
    <Page>
      <Link to={lot.auction ? `/leiloes/${lot.auction_id}` : '/leiloes'} className="mb-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {lot.auction?.title ?? 'Leilões'}
      </Link>
      <div className={cx('grid gap-10 lg:gap-12', lot.kind === 'combo' ? 'lg:grid-cols-[1.4fr_1fr]' : 'lg:grid-cols-[1fr_1fr]')}>
        {/* Gallery */}
        <div className="min-w-0">
          {single ? (
            <div className="mx-auto max-w-[440px]">
              <FlipCard card={single} eager />
              <div className="mt-6 grid grid-cols-2 gap-3">
                {photos.map((p, i) => (
                  <button key={i} type="button" onClick={() => setLb(i)} className="group overflow-hidden rounded-2xl border border-line" aria-label={`Ampliar ${p.alt}`}>
                    <CardImage path={p.path} alt="" className="aspect-[5/7] transition-transform duration-500 group-hover:scale-[1.03]" />
                  </button>
                ))}
              </div>
              <Lightbox photos={photos} index={lb} onClose={() => setLb(null)} onIndex={setLb} />
            </div>
          ) : (
            <div>
              <div className="mb-5 flex items-center gap-2 text-lg font-semibold">
                <Layers aria-hidden className="size-5 text-accent-text" /> Combo com {lot.card_count} cartas
              </div>
              <ComboGallery cards={lot.cards} />
            </div>
          )}
        </div>

        {/* Details + bidding */}
        <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <LotStatusBadge lot={lot} startsAt={lot.auction?.starts_at} />
            {lot.kind === 'combo' && <Badge tone="mint">Combo · {lot.card_count} cartas</Badge>}
          </div>
          <h1 className="mt-3 text-4xl leading-[1.04] sm:text-5xl">{lot.title}</h1>
          {single && (
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-3">
              <div><dt className="text-subtle">Coleção</dt><dd className="font-medium">{single.collection || '—'}</dd></div>
              <div><dt className="text-subtle">Idioma</dt><dd className="mt-0.5"><LanguageTag value={single.language} /></dd></div>
              <div><dt className="text-subtle">Condição</dt><dd className="mt-0.5"><ConditionTag value={single.condition} long /></dd></div>
            </dl>
          )}
          {single?.pokemon?.length ? <div className="mt-4"><PokemonChips card={single} /></div> : null}
          {lot.description && <p className="mt-5 text-[17px] leading-relaxed text-muted">{lot.description}</p>}
          {single?.notes && single.notes !== lot.description && (
            <p className="mt-3 flex gap-2 rounded-2xl bg-surface-2 p-3.5 text-[15px] text-muted">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" /> {single.notes}
            </p>
          )}

          <div className="mt-7 rounded-[1.75rem] border border-line-strong bg-surface p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-subtle">{phase === 'ended' ? 'Valor final' : lot.current_price ? 'Maior lance' : 'Lance inicial'}</p>
                <RollingPrice value={money(phase === 'ended' ? (lot.winning_amount ?? lot.current_price ?? lot.starting_price) : (lot.current_price ?? lot.starting_price))} className="text-4xl font-bold sm:text-5xl" />
                <p className="mt-1 text-[15px] text-muted">
                  {lot.bid_count} {lot.bid_count === 1 ? 'lance' : 'lances'} · {lot.bidder_count} {lot.bidder_count === 1 ? 'participante' : 'participantes'} · incremento {money(lot.increment)}
                </p>
              </div>
              {phase !== 'ended' && (
                <div className="text-right">
                  <p className="text-sm text-subtle">{phase === 'upcoming' ? 'Abre em' : `Encerra às ${timeOnly(lot.ends_at)}`}</p>
                  <Countdown to={phase === 'upcoming' ? lot.auction!.starts_at : lot.ends_at} compact onEnd={phase === 'live' ? onEnd : reload} />
                </div>
              )}
            </div>
            {lot.my_rank != null && phase !== 'ended' && (
              <p className={cx('mt-4 flex items-center gap-2 rounded-2xl px-4 py-2.5 font-semibold', lot.my_rank === 1 ? 'bg-accent-soft text-accent-text' : 'bg-warning-soft text-warning')}>
                {lot.my_rank === 1 ? <Crown aria-hidden className="size-4" /> : <AlertTriangle aria-hidden className="size-4" />}
                {lot.my_rank === 1 ? `Você lidera com ${money(lot.my_amount)}` : `Você está em ${lot.my_rank}º com ${money(lot.my_amount)}`}
              </p>
            )}
            <div className="mt-5 border-t border-line pt-5">
              {phase === 'live' ? (
                <BidPanel lot={lot} onDone={reload} onSuccess={setSuccess} />
              ) : phase === 'upcoming' ? (
                <p className="text-[15px] text-muted">Os lances abrem {dateLong(lot.auction?.starts_at)}. Lance inicial {money(lot.starting_price)}{lot.buyout_price ? `, arremate imediato ${money(lot.buyout_price)}` : ''}.</p>
              ) : (
                <Result lot={lot} />
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[15px] text-subtle">
            <span>Encerramento oficial: {dateTime(lot.ends_at)}</span>
            <button type="button" onClick={share} className="inline-flex items-center gap-1.5 font-medium hover:text-ink">
              <Share2 aria-hidden className="size-4" /> Compartilhar
            </button>
          </div>

          <BidBoard bids={board} loading={boardLoading} />
          <SuccessModal state={success} lot={lot} onClose={() => setSuccess(null)} />
        </div>
      </div>
    </Page>
  )
}

function Result({ lot }: { lot: Lot }) {
  if (lot.status === 'unsold') return <p className="text-[15px] text-muted">Este lote encerrou sem lances.</p>
  if (lot.status === 'cancelled') return <p className="text-[15px] text-muted">Este lote foi cancelado pela equipe.</p>
  if (lot.status === 'open') return <p className="text-[15px] text-muted">Encerrando… o resultado aparece em instantes.</p>
  return (
    <div className="flex items-center gap-4">
      {lot.is_winner ? (
        <Mascot pose="celebrating" width={64} motion="pop" />
      ) : (
        <span className="grid size-12 place-items-center rounded-2xl bg-surface-3 text-ink">
          <Trophy aria-hidden className="size-6" />
        </span>
      )}
      <div>
        <p className="font-semibold">{lot.is_winner ? 'Você venceu este lote!' : `Vencedor: ${lot.winner_alias}`}</p>
        <p className="text-[15px] text-muted">
          {lot.status === 'sold' ? 'Arremate imediato' : 'Encerrado no horário'} · {money(lot.winning_amount)}
        </p>
        {lot.is_winner && <Link to="/conta/pedidos" className="mt-1 inline-block text-[15px] font-semibold text-accent-text hover:underline">Ver meus pedidos</Link>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Bid panel — confirmation required; only server-confirmed results shown.
// ---------------------------------------------------------------------
function BidPanel({ lot, onDone, onSuccess }: { lot: Lot; onDone(): void; onSuccess(s: { r: BidResult; buyout: boolean }): void }) {
  const { session } = useAuth()
  const loc = useLocation()
  const min = leadingMinimum(lot)
  const [raw, setRaw] = useState(min.toFixed(2).replace('.', ','))
  const [touched, setTouched] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [buyout, setBuyout] = useState<0 | 1 | 2>(0)
  const [agree, setAgree] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  // one idempotency key per intent: retries after a network error reuse it
  const keyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!touched) setRaw(min.toFixed(2).replace('.', ','))
  }, [min, touched])

  const amount = Number(raw.replace(/\./g, '').replace(',', '.'))
  const check = useMemo(() => checkBid(lot, amount), [lot, amount])
  const hint = !check.ok
    ? new AppError(check.code).message
    : {
        opening: 'Você abre o lote com este valor.',
        leading: 'Com este valor você assume a liderança.',
        tie: 'Mesmo valor do maior lance: você fica logo atrás de quem registrou antes.',
        secondary: 'Abaixo do maior lance: você entra na classificação, atrás dos valores maiores.',
      }[check.kind]

  const step = (dir: 1 | -1) => {
    setTouched(true)
    const base = Number.isFinite(amount) ? amount : min
    const next = Math.max(Number(lot.starting_price), Math.round((base + dir * Number(lot.increment)) * 100) / 100)
    setRaw(next.toFixed(2).replace('.', ','))
  }

  if (!session)
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[15px] text-muted">Entre na sua conta para dar lances.</p>
        <ButtonLink to={`/entrar?voltar=${encodeURIComponent(loc.pathname)}`}>Entrar para dar lance</ButtonLink>
      </div>
    )

  const submit = async (isBuyout: boolean) => {
    if (!keyRef.current) keyRef.current = crypto.randomUUID()
    setPending(true)
    setError(null)
    try {
      const r = isBuyout ? await api.buyNow(lot.id, keyRef.current) : await api.placeBid(lot.id, amount, keyRef.current)
      keyRef.current = null
      setConfirm(false)
      setBuyout(0)
      setTouched(false)
      onSuccess({ r, buyout: isBuyout })
      onDone()
    } catch (e) {
      const err = toAppError(e)
      // keep the key only for network failures (the bid may or may not have landed)
      if (err.code !== 'NETWORK') keyRef.current = null
      setError(err)
      if (['LOT_CLOSED', 'LOT_ENDED'].includes(err.code)) onDone()
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <label htmlFor="bid-amount" className="text-sm font-medium">Seu lance</label>
      <div className="mt-2 flex items-stretch gap-2">
        <button type="button" onClick={() => step(-1)} aria-label={`Diminuir ${money(lot.increment)}`} className="grid w-12 shrink-0 place-items-center rounded-2xl border border-line-strong hover:border-accent">
          <Minus className="size-4" />
        </button>
        <div className="relative flex-1">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg font-semibold text-subtle">R$</span>
          <input
            id="bid-amount"
            inputMode="decimal"
            autoComplete="off"
            value={raw}
            onChange={(e) => {
              setTouched(true)
              setRaw(e.target.value.replace(/[^\d.,]/g, ''))
            }}
            aria-invalid={!check.ok || undefined}
            aria-describedby="bid-hint"
            className="tabular h-14 w-full rounded-2xl border border-line-strong bg-bg pr-4 pl-12 text-2xl font-bold focus:border-accent focus:ring-4 focus:ring-accent/20 focus:outline-none aria-[invalid=true]:border-danger"
          />
        </div>
        <button type="button" onClick={() => step(1)} aria-label={`Aumentar ${money(lot.increment)}`} className="grid w-12 shrink-0 place-items-center rounded-2xl border border-line-strong hover:border-accent">
          <Plus className="size-4" />
        </button>
      </div>
      <p id="bid-hint" className={cx('mt-2 min-h-5 text-[14px]', check.ok ? 'text-muted' : 'text-danger')}>{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <QuickChip onClick={() => (setTouched(true), setRaw(min.toFixed(2).replace('.', ',')))}>Liderar · {money(min)}</QuickChip>
        {lot.current_price != null && (lot.my_amount == null || lot.my_amount < lot.current_price) && (
          <QuickChip onClick={() => (setTouched(true), setRaw(Number(lot.current_price).toFixed(2).replace('.', ',')))}>Igualar · {money(lot.current_price)}</QuickChip>
        )}
      </div>
      <Button size="lg" className="mt-5 w-full" disabled={!check.ok} onClick={() => (setError(null), setConfirm(true))} icon={<Gavel aria-hidden className="size-5" />}>
        Dar lance de {Number.isFinite(amount) ? money(amount) : '—'}
      </Button>
      {lot.buyout_price != null && (
        <Button size="lg" variant="gold" className="mt-3 w-full" onClick={() => (setError(null), setAgree(false), setBuyout(1))} icon={<Zap aria-hidden className="size-5" />}>
          Arrematar agora por {money(lot.buyout_price)}
        </Button>
      )}

      {/* Bid confirmation */}
      <Modal
        open={confirm}
        onClose={() => !pending && setConfirm(false)}
        dismissable={!pending}
        title="Confirmar lance"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>Voltar</Button>
            <Button loading={pending} onClick={() => void submit(false)}>{error?.code === 'NETWORK' ? 'Tentar de novo' : 'Confirmar lance'}</Button>
          </>
        }
      >
        <LotSummary lot={lot} amount={amount} />
        <p className="mt-4 flex gap-2 rounded-2xl bg-warning-soft p-3.5 text-[14px] text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> Depois de confirmado, o lance não pode ser retirado.
        </p>
        <ErrorBox error={error} />
      </Modal>

      {/* Buyout: two-step confirmation */}
      <Modal
        open={buyout > 0}
        onClose={() => !pending && setBuyout(0)}
        dismissable={!pending}
        title={buyout === 1 ? 'Arrematar agora?' : 'Confirmação final'}
        description={buyout === 1 ? 'O lote fecha na hora para todos e fica com quem confirmar primeiro.' : 'Esta é uma compra. Ao confirmar, o valor entra no seu pedido deste leilão.'}
        size="sm"
        footer={
          buyout === 1 ? (
            <>
              <Button variant="ghost" onClick={() => setBuyout(0)}>Voltar</Button>
              <Button variant="gold" onClick={() => setBuyout(2)}>Continuar</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setBuyout(1)} disabled={pending}>Voltar</Button>
              <Button variant="gold" loading={pending} disabled={!agree} onClick={() => void submit(true)}>
                {error?.code === 'NETWORK' ? 'Tentar de novo' : `Comprar por ${money(lot.buyout_price)}`}
              </Button>
            </>
          )
        }
      >
        <LotSummary lot={lot} amount={Number(lot.buyout_price)} buyout />
        {buyout === 2 && (
          <div className="mt-4 rounded-2xl border border-gold/40 bg-gold-soft p-4">
            <Checkbox checked={agree} onChange={setAgree} label={`Confirmo a compra de “${lot.title}” por ${money(lot.buyout_price)}.`} />
          </div>
        )}
        <ErrorBox error={error} />
      </Modal>

      {error && !confirm && !buyout && <ErrorBox error={error} />}
    </div>
  )
}

function QuickChip({ children, onClick }: { children: React.ReactNode; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} className="tabular h-9 rounded-xl border border-line-strong px-3 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-ink">
      {children}
    </button>
  )
}

function LotSummary({ lot, amount, buyout }: { lot: Lot; amount: number; buyout?: boolean }) {
  const c = lot.cards[0]
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-surface p-3">
      <CardImage path={c?.front_path ?? null} alt="" className="aspect-[5/7] w-20 shrink-0 rounded-xl" />
      <div className="min-w-0">
        <p className="line-clamp-2 font-semibold">{lot.title}</p>
        <p className="text-[14px] text-subtle">
          {lot.kind === 'combo' ? `Combo · ${lot.card_count} cartas` : c ? `${conditionLabel(c.condition)} · ${languageMeta(c.language).label}` : ''}
        </p>
        <p className="mt-2 text-sm text-subtle">{buyout ? 'Valor do arremate' : 'Valor do lance'}</p>
        <p className="tabular text-2xl font-bold">{money(amount)}</p>
      </div>
    </div>
  )
}

function ErrorBox({ error }: { error: AppError | null }) {
  if (!error) return null
  const net = error.code === 'NETWORK'
  return (
    <div role="alert" className="mt-4 flex gap-2 rounded-2xl border border-danger/30 bg-danger-soft p-3.5 text-[14px] text-danger">
      {net ? <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <span>
        {error.message}
        {net && ' Ao tentar de novo usamos o mesmo pedido, então o lance nunca é registrado duas vezes.'}
      </span>
    </div>
  )
}

function SuccessModal({ state, lot, onClose }: { state: { r: BidResult; buyout: boolean } | null; lot: Lot; onClose(): void }) {
  const reduce = useReducedMotion()
  const won = state?.buyout
  return (
    <Modal open={!!state} onClose={onClose} title={won ? 'Arremate confirmado!' : 'Lance registrado'} size="sm" footer={<Button onClick={onClose}>Fechar</Button>}>
      {state && (
        <div className="relative py-2 text-center">
          {won && !reduce && <Burst />}
          {won ? (
            // shown only after the server confirmed the buyout
            <Mascot pose="celebrating" width={124} motion="pop" eager className="relative mx-auto" />
          ) : (
            <motion.div
              initial={reduce ? false : { scale: 0.6, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="mx-auto grid size-20 place-items-center rounded-3xl bg-accent text-accent-ink"
            >
              <Check className="size-10" />
            </motion.div>
          )}
          <p className="tabular mt-5 text-3xl font-bold">{money(state.r.amount)}</p>
          <p className="mt-1 text-muted">{lot.title}</p>
          <p className="mt-4 text-[15px]">
            {won ? 'O lote é seu. O pedido aparece em “Meus pedidos” quando o leilão terminar.' : state.r.rank === 1 ? 'Confirmado pelo servidor: você lidera.' : `Confirmado pelo servidor: você está em ${state.r.rank}º lugar.`}
          </p>
          <p className="tabular mt-1 text-[13px] text-subtle">Registro #{state.r.bid_id} · {dateTime(state.r.created_at)}</p>
        </div>
      )}
    </Modal>
  )
}

function Burst() {
  const parts = Array.from({ length: 16 })
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
      {parts.map((_, i) => {
        const a = (i / parts.length) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="absolute size-3"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: Math.cos(a) * 130, y: Math.sin(a) * 90, opacity: 0, scale: 1, rotate: 180 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          >
            <svg viewBox="0 0 10 10" className="size-full" fill={i % 3 === 0 ? '#F5C76B' : i % 3 === 1 ? '#40D9D0' : '#FFF1D6'}>
              <path d="M5 0l1.3 3.7L10 5 6.3 6.3 5 10 3.7 6.3 0 5l3.7-1.3z" />
            </svg>
          </motion.span>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------
// Public bid board
// ---------------------------------------------------------------------
function BidBoard({ bids, loading }: { bids: BoardBid[]; loading: boolean }) {
  const [all, setAll] = useState(false)
  const list = all ? bids : bids.slice(0, 8)
  return (
    <section aria-labelledby="board-title" className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="board-title" className="text-xl">Histórico de lances</h2>
        <span className="text-sm text-subtle">maior valor → ordem de registro</span>
      </div>
      {loading && bids.length === 0 ? (
        <Skeleton className="h-40" />
      ) : bids.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Nenhum lance ainda. O primeiro pode ser o seu.</p>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-line">
          <AnimatePresence initial={false}>
            {list.map((b, i) => (
              <motion.li
                key={b.bid_id}
                layout
                initial={{ opacity: 0, backgroundColor: 'var(--accent-soft)' }}
                animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                transition={{ duration: 1.2 }}
                className={cx('grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 px-4 py-3', i > 0 && 'border-t border-line', b.is_me && 'bg-accent-soft/60')}
              >
                <span className={cx('tabular text-sm font-bold', b.user_rank === 1 ? 'text-accent-text' : 'text-subtle')}>{b.user_rank ? `${b.user_rank}º` : '·'}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {b.alias} {b.is_me && <span className="text-accent-text">(você)</span>}
                    {b.is_buyout && <Badge tone="gold" className="ml-2 h-6">Arremate</Badge>}
                  </span>
                  <span className="tabular block text-[13px] text-subtle">#{b.bid_id} · {dateTime(b.created_at)}</span>
                </span>
                <span className={cx('tabular font-bold', !b.user_rank && 'text-subtle line-through decoration-1')}>{money(b.amount)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      {bids.length > 8 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-3 text-[15px] font-semibold text-accent-text hover:underline">
          {all ? 'Mostrar menos' : `Ver todos os ${bids.length} lances`}
        </button>
      )}
      <p className="mt-3 text-[13px] text-subtle">Lances riscados foram superados pelo próprio participante; vale o maior de cada pessoa.</p>
    </section>
  )
}
