import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Copy, Eye, Layers, ListOrdered, Pencil, Plus, Rocket, Search, StopCircle, Trash2, Undo2, X, XCircle } from 'lucide-react'
import { Badge, Button, ChipGroup, ConfirmDialog, cx, EmptyState, ErrorState, Field, Input, Modal, Skeleton, Textarea } from '@/components/ui'
import { CardImage, ConditionTag, LanguageTag } from '@/components/cards/CardVisuals'
import { useAuth, useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { nextAuctionSlots, paymentDueFor } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { dateLong, dateTime, fromLocalInput, LOT_STATUS, money, toLocalInput, weekdayTime } from '@/lib/format'
import type { Auction, Card, Lot, LotKind } from '@/lib/types'
import { AdminHeader, Panel } from './AdminLayout'
import { AuctionBadge, auctionPhase } from './Auctions'
import { CardFormModal } from './Cards'
import { RankingModal } from './Ranking'

export default function AuctionEdit() {
  const { id } = useParams()
  if (!id) return <NewAuction />
  return <EditAuction id={id} />
}

// ---------------------------------------------------------------------
// Step 1: create (details + dates)
// ---------------------------------------------------------------------
function DetailsForm({ initial, onSave, busy, locked }: { initial?: Auction; onSave(v: { title: string; description: string; starts_at: string; ends_at: string; payment_due_at: string | null }): void; busy: boolean; locked?: boolean }) {
  const slots = useMemo(() => nextAuctionSlots(new Date(), 4), [])
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [start, setStart] = useState(toLocalInput(initial?.starts_at ?? slots[0].starts.toISOString()))
  const [end, setEnd] = useState(toLocalInput(initial?.ends_at ?? slots[0].ends.toISOString()))
  const [customDue, setCustomDue] = useState(initial?.payment_due_at && initial.payment_due_at !== paymentDueFor(new Date(initial.ends_at)).toISOString() ? toLocalInput(initial.payment_due_at) : '')
  const [err, setErr] = useState<string | null>(null)
  const official = slots.find((s) => toLocalInput(s.starts.toISOString()) === start && toLocalInput(s.ends.toISOString()) === end)
  const defaultDue = end ? paymentDueFor(new Date(fromLocalInput(end))) : null
  const submit = () => {
    if (title.trim().length < 2) return setErr('Dê um nome ao leilão.')
    if (!start || !end || fromLocalInput(end) <= fromLocalInput(start)) return setErr('O encerramento precisa ser depois do início.')
    setErr(null)
    onSave({ title: title.trim(), description, starts_at: fromLocalInput(start), ends_at: fromLocalInput(end), payment_due_at: customDue ? fromLocalInput(customDue) : null })
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nome do leilão">{(p) => <Input id={p.id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leilão de Terça" maxLength={160} />}</Field>
        <Field label="Descrição" optional>{(p) => <Input id={p.id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} />}</Field>
      </div>
      <fieldset disabled={locked}>
        <legend className="mb-2 text-sm font-medium">Horário oficial</legend>
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => {
            const on = official === s
            return (
              <button
                key={s.starts.toISOString()}
                type="button"
                onClick={() => (setStart(toLocalInput(s.starts.toISOString())), setEnd(toLocalInput(s.ends.toISOString())))}
                className={cx('rounded-xl border px-3.5 py-2 text-left text-[14px] transition-colors', on ? 'border-accent bg-accent-soft text-accent-text' : 'border-line-strong hover:border-accent/60')}
              >
                <span className="block font-semibold capitalize">{weekdayTime(s.starts.toISOString())}</span>
                <span className="block text-[12px] text-subtle">até {weekdayTime(s.ends.toISOString())}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label="Início (Brasília)">{(p) => <Input id={p.id} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="Encerramento (Brasília)" hint={official ? 'Horário oficial: 24 horas.' : 'Data excepcional.'}>{(p) => <Input id={p.id} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} aria-describedby={p.describedBy} />}</Field>
        </div>
      </fieldset>
      <Field label="Prazo de pagamento" optional hint={defaultDue ? `Padrão: ${dateLong(defaultDue.toISOString())}. Preencha só para mudar.` : undefined}>
        {(p) => <Input id={p.id} type="datetime-local" value={customDue} onChange={(e) => setCustomDue(e.target.value)} aria-describedby={p.describedBy} className="sm:max-w-xs" />}
      </Field>
      {err && <p role="alert" className="text-[14px] font-medium text-danger">{err}</p>}
      <Button loading={busy} onClick={submit}>{initial ? 'Salvar dados' : 'Criar e adicionar lotes'}</Button>
    </div>
  )
}

function NewAuction() {
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <>
      <Link to="/admin/leiloes" className="mb-4 inline-flex items-center gap-1.5 text-[15px] text-muted hover:text-ink"><ArrowLeft className="size-4" /> Leilões</Link>
      <AdminHeader title="Novo leilão">1. Dados e horário → 2. Lotes e valores → 3. Revisar e publicar</AdminHeader>
      <Panel>
        <DetailsForm
          busy={busy}
          onSave={async (v) => {
            setBusy(true)
            try {
              const id = await api.admin.saveAuction(v)
              toast({ kind: 'success', title: 'Rascunho criado', body: 'Agora adicione os lotes.' })
              nav(`/admin/leiloes/${id}`, { replace: true })
            } catch (e) {
              toast({ kind: 'error', title: 'Não foi possível criar', body: errorMessage(e) })
            } finally {
              setBusy(false)
            }
          }}
        />
      </Panel>
    </>
  )
}

// ---------------------------------------------------------------------
// Edit: lots, review, publish, operations
// ---------------------------------------------------------------------
function EditAuction({ id }: { id: string }) {
  const q = useQuery(`admin:auction:${id}`, () => api.admin.auction(id), { live: { topic: 'lots' } })
  const { isSuperAdmin } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [editDetails, setEditDetails] = useState(false)
  const [lotForm, setLotForm] = useState<Lot | 'new' | null>(null)
  const [review, setReview] = useState(false)
  const [dialog, setDialog] = useState<null | { kind: 'cancel' | 'unpublish' | 'deleteLot' | 'endLot' | 'cancelLot'; lot?: Lot }>(null)
  const [ranking, setRanking] = useState<string | null>(null)
  const [dup, setDup] = useState(false)

  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (q.loading && !q.data) return <Skeleton className="h-96" />
  const a = q.data
  if (!a) return <EmptyState mascot="confused" title="Leilão não encontrado" />
  const phase = auctionPhase(a)
  const lots = a.lots ?? []
  const editable = a.status === 'draft' || a.status === 'published'

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast({ kind: 'success', title: ok })
      setDialog(null)
      void q.reload()
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível concluir', body: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }
  const move = async (lot: Lot, dir: -1 | 1) => {
    const j = lots.findIndex((l) => l.id === lot.id) + dir
    if (j < 0 || j >= lots.length) return
    const other = lots[j]
    await run(async () => {
      await api.admin.saveLot({ ...toLotPayload(lot), position: other.position === lot.position ? lot.position + dir : other.position })
      await api.admin.saveLot({ ...toLotPayload(other), position: lot.position })
    }, 'Ordem atualizada')
  }

  return (
    <>
      <Link to="/admin/leiloes" className="mb-4 inline-flex items-center gap-1.5 text-[15px] text-muted hover:text-ink"><ArrowLeft className="size-4" /> Leilões</Link>
      <AdminHeader
        title={a.title}
        action={
          <>
            <Button variant="secondary" onClick={() => window.open(`${import.meta.env.BASE_URL}leiloes/${a.id}`, '_blank')} icon={<Eye className="size-4" />}>Pré-visualizar</Button>
            <Button variant="secondary" onClick={() => setDup(true)} icon={<Copy className="size-4" />}>Duplicar</Button>
            {a.status === 'draft' && <Button onClick={() => setReview(true)} icon={<Rocket className="size-4" />}>Revisar e publicar</Button>}
            {a.status === 'published' && a.bid_count === 0 && <Button variant="secondary" onClick={() => setDialog({ kind: 'unpublish' })} icon={<Undo2 className="size-4" />}>Voltar a rascunho</Button>}
            {editable && (a.bid_count === 0 || isSuperAdmin) && <Button variant="danger" onClick={() => setDialog({ kind: 'cancel' })} icon={<XCircle className="size-4" />}>Cancelar</Button>}
          </>
        }
      >
        <span className="flex flex-wrap items-center gap-2">
          <AuctionBadge a={a} /> {dateLong(a.starts_at)} → {dateLong(a.ends_at)} · pagamento até {dateTime(a.payment_due_at)}
        </span>
      </AdminHeader>

      {editDetails ? (
        <Panel title="Dados do leilão" className="mb-6" action={<button type="button" onClick={() => setEditDetails(false)} aria-label="Fechar edição" className="rounded-full p-2 hover:bg-surface-2"><X className="size-4" /></button>}>
          <DetailsForm
            initial={a}
            busy={busy}
            locked={a.bid_count > 0}
            onSave={(v) => run(async () => { await api.admin.saveAuction({ id: a.id, ...v, sync_lot_ends: true }); setEditDetails(false) }, 'Leilão atualizado')}
          />
        </Panel>
      ) : (
        editable && (
          <button type="button" onClick={() => setEditDetails(true)} className="mb-6 inline-flex items-center gap-2 text-[15px] font-semibold text-accent-text hover:underline">
            <Pencil className="size-4" /> Editar nome, descrição e horários
          </button>
        )
      )}

      <Panel
        title={`Lotes (${lots.length})`}
        action={editable && <Button size="sm" onClick={() => setLotForm('new')} icon={<Plus className="size-4" />}>Adicionar lote</Button>}
      >
        {lots.length === 0 ? (
          <EmptyState icon={<Layers className="size-6" />} title="Nenhum lote ainda" action={<Button onClick={() => setLotForm('new')}>Adicionar o primeiro lote</Button>}>
            Cada lote pode ser uma carta individual ou um combo com várias cartas.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {lots.map((l, i) => (
              <li key={l.id} className="grid gap-4 rounded-2xl border border-line bg-bg/40 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <div className="flex -space-x-6">
                  {l.cards.slice(0, 3).map((c) => <CardImage key={c.id} path={c.front_path} alt="" className="aspect-[5/7] w-14 rounded-lg ring-2 ring-bg" />)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{l.title}</p>
                    {l.kind === 'combo' && <Badge tone="mint">Combo · {l.card_count}</Badge>}
                    <Badge tone={l.status === 'open' && a.status !== 'draft' ? 'accent' : 'neutral'}>{a.status === 'draft' ? 'Não publicado' : LOT_STATUS[l.status]}</Badge>
                  </div>
                  <p className="tabular mt-1 text-[14px] text-muted">
                    Inicial {money(l.starting_price)} · incremento {money(l.increment)} · arremate {l.buyout_price ? money(l.buyout_price) : '—'}
                    {l.ends_at !== a.ends_at && ` · encerra ${dateTime(l.ends_at)}`}
                  </p>
                  <p className="tabular text-[14px] text-subtle">
                    {l.bid_count} lances{l.current_price ? ` · maior ${money(l.current_price)}` : ''}{l.winner_alias ? ` · vencedor ${l.winner_alias} (${money(l.winning_amount)})` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {editable && l.bid_count === 0 && (
                    <>
                      <IconBtn label="Mover para cima" onClick={() => move(l, -1)} disabled={i === 0}><ArrowUp className="size-4" /></IconBtn>
                      <IconBtn label="Mover para baixo" onClick={() => move(l, 1)} disabled={i === lots.length - 1}><ArrowDown className="size-4" /></IconBtn>
                      <IconBtn label="Editar lote" onClick={() => setLotForm(l)}><Pencil className="size-4" /></IconBtn>
                      <IconBtn label="Excluir lote" onClick={() => setDialog({ kind: 'deleteLot', lot: l })} danger><Trash2 className="size-4" /></IconBtn>
                    </>
                  )}
                  {l.bid_count > 0 && <Button size="sm" variant="secondary" onClick={() => setRanking(l.id)} icon={<ListOrdered className="size-4" />}>Classificação</Button>}
                  {l.status === 'open' && phase !== 'draft' && isSuperAdmin && <IconBtn label="Encerrar agora" onClick={() => setDialog({ kind: 'endLot', lot: l })}><StopCircle className="size-4" /></IconBtn>}
                  {l.status === 'open' && phase !== 'draft' && (l.bid_count === 0 || isSuperAdmin) && <IconBtn label="Cancelar lote" onClick={() => setDialog({ kind: 'cancelLot', lot: l })} danger><XCircle className="size-4" /></IconBtn>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <LotFormModal auction={a} lot={lotForm === 'new' ? null : lotForm} open={lotForm !== null} onClose={() => setLotForm(null)} onSaved={() => { setLotForm(null); void q.reload() }} />
      <ReviewModal auction={a} open={review} busy={busy} onClose={() => setReview(false)} onPublish={() => run(async () => { await api.admin.publish(a.id); setReview(false) }, new Date(a.starts_at).getTime() > Date.now() ? 'Leilão agendado e publicado' : 'Leilão publicado e aberto')} />
      <RankingModal lotId={ranking} onClose={() => setRanking(null)} onChanged={q.reload} />
      <DuplicateModal auction={dup ? a : null} onClose={() => setDup(false)} />
      <ConfirmDialog open={dialog?.kind === 'unpublish'} onClose={() => setDialog(null)} loading={busy} title="Voltar a rascunho?" description="O leilão deixa de aparecer no site até ser publicado de novo." onConfirm={() => run(() => api.admin.unpublish(a.id), 'Leilão voltou a rascunho')} />
      <ConfirmDialog open={dialog?.kind === 'cancel'} onClose={() => setDialog(null)} loading={busy} tone="danger" requireReason title="Cancelar leilão?" description="Todos os lotes abertos são cancelados. Os lances existentes ficam registrados. Não pode ser desfeito." confirmLabel="Cancelar leilão" onConfirm={(r) => run(async () => { await api.admin.cancelAuction(a.id, r); nav('/admin/leiloes') }, 'Leilão cancelado')} />
      <ConfirmDialog open={dialog?.kind === 'deleteLot'} onClose={() => setDialog(null)} loading={busy} tone="danger" title="Excluir lote?" description={`“${dialog?.lot?.title}” será removido. As cartas continuam no cadastro.`} confirmLabel="Excluir" onConfirm={() => run(() => api.admin.deleteLot(dialog!.lot!.id), 'Lote excluído')} />
      <ConfirmDialog open={dialog?.kind === 'endLot'} onClose={() => setDialog(null)} loading={busy} tone="danger" requireReason title="Encerrar lote agora?" description="Ação excepcional: o lote fecha antes do horário oficial e o vencedor é calculado normalmente. Fica registrado na auditoria." confirmLabel="Encerrar agora" onConfirm={(r) => run(() => api.admin.endLotNow(dialog!.lot!.id, r), 'Lote encerrado')} />
      <ConfirmDialog open={dialog?.kind === 'cancelLot'} onClose={() => setDialog(null)} loading={busy} tone="danger" requireReason title="Cancelar lote?" description="Ninguém vence este lote. Os lances ficam no histórico. Fica registrado na auditoria." confirmLabel="Cancelar lote" onConfirm={(r) => run(() => api.admin.cancelLot(dialog!.lot!.id, r), 'Lote cancelado')} />
    </>
  )
}

function IconBtn({ label, onClick, children, danger, disabled }: { label: string; onClick(): void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cx('grid size-9 place-items-center rounded-xl text-subtle transition-colors disabled:opacity-30', danger ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-surface-2 hover:text-ink')}>
      {children}
    </button>
  )
}

const toLotPayload = (l: Lot) => ({
  id: l.id, auction_id: l.auction_id, kind: l.kind, title: l.title, description: l.description,
  starting_price: l.starting_price, increment: l.increment, buyout_price: l.buyout_price, ends_at: l.ends_at, position: l.position,
  card_ids: l.cards.map((c) => c.id),
})

function ReviewModal({ auction, open, onClose, onPublish, busy }: { auction: Auction; open: boolean; onClose(): void; onPublish(): void; busy: boolean }) {
  const lots = auction.lots ?? []
  const problems = [
    ...(lots.length === 0 ? ['Adicione ao menos um lote.'] : []),
    ...(new Date(auction.ends_at).getTime() <= Date.now() ? ['O encerramento já passou.'] : []),
    ...lots.filter((l) => (l.kind === 'single' ? l.card_count !== 1 : l.card_count < 2)).map((l) => `“${l.title}” tem cartas inválidas para o tipo.`),
    ...lots.flatMap((l) => l.cards.filter((c) => !c.front_path || !c.back_path).map((c) => `“${c.title}” está sem foto de frente ou verso.`)),
  ]
  const blocking = problems.filter((p) => !p.includes('sem foto'))
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Revisar antes de publicar"
      description={new Date(auction.starts_at).getTime() > Date.now() ? `Fica visível agora e abre para lances ${dateLong(auction.starts_at)}.` : 'Abre para lances imediatamente.'}
      size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Voltar</Button><Button loading={busy} disabled={blocking.length > 0} onClick={onPublish} icon={<Rocket className="size-4" />}>Publicar</Button></>}
    >
      <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-surface-2 p-4 text-[15px] sm:grid-cols-4">
        <div><dt className="text-subtle">Início</dt><dd className="font-medium">{dateTime(auction.starts_at)}</dd></div>
        <div><dt className="text-subtle">Encerramento</dt><dd className="font-medium">{dateTime(auction.ends_at)}</dd></div>
        <div><dt className="text-subtle">Pagamento até</dt><dd className="font-medium">{dateTime(auction.payment_due_at)}</dd></div>
        <div><dt className="text-subtle">Lotes</dt><dd className="font-medium">{lots.length}</dd></div>
      </dl>
      {problems.length > 0 ? (
        <ul className="mt-4 space-y-1.5 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-[14px] text-warning">
          {problems.map((p) => <li key={p}>• {p}</li>)}
        </ul>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-success-soft p-3 text-[14px]"><CheckCircle2 className="size-4 text-success" /> Tudo certo para publicar.</p>
      )}
      <ul className="mt-4 mb-4 divide-y divide-line rounded-2xl border border-line">
        {lots.map((l) => (
          <li key={l.id} className="flex items-center gap-3 p-3">
            <CardImage path={l.cards[0]?.front_path ?? null} alt="" className="aspect-[5/7] w-10 rounded-md" />
            <span className="min-w-0 flex-1 truncate font-medium">{l.title}</span>
            <span className="tabular text-[14px] text-muted">{money(l.starting_price)} +{money(l.increment)}{l.buyout_price ? ` · ⚡${money(l.buyout_price)}` : ''}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export function DuplicateModal({ auction, onClose }: { auction: Auction | null; onClose(): void }) {
  const nav = useNavigate()
  const toast = useToast()
  const slots = useMemo(() => nextAuctionSlots(new Date(), 4), [])
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={!!auction}
      onClose={onClose}
      title="Duplicar leilão"
      description="Cria um rascunho com os mesmos lotes e cartas, sem lances."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const id = await api.admin.duplicate(auction!.id, slots[i].starts.toISOString(), slots[i].ends.toISOString())
                toast({ kind: 'success', title: 'Cópia criada como rascunho' })
                onClose()
                nav(`/admin/leiloes/${id}`)
              } catch (e) {
                toast({ kind: 'error', title: 'Não foi possível duplicar', body: errorMessage(e) })
              } finally {
                setBusy(false)
              }
            }}
          >
            Duplicar
          </Button>
        </>
      }
    >
      <ChipGroup label="Novo horário" value={String(i)} onChange={(v) => v && setI(Number(v))} options={slots.map((s, k) => ({ value: String(k), label: <span className="capitalize">{weekdayTime(s.starts.toISOString())}</span> }))} />
      <div className="h-4" />
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Lot form with card picker
// ---------------------------------------------------------------------
function LotFormModal({ auction, lot, open, onClose, onSaved }: { auction: Auction; lot: Lot | null; open: boolean; onClose(): void; onSaved(): void }) {
  const toast = useToast()
  const [kind, setKind] = useState<LotKind>('single')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [start, setStart] = useState('')
  const [inc, setInc] = useState('')
  const [buy, setBuy] = useState('')
  const [ends, setEnds] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [search, setSearch] = useState('')
  const [newCard, setNewCard] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const lib = useQuery(`admin:cards:pick:${search}`, () => api.admin.cards(search, 40), { enabled: open })
  useEffect(() => {
    if (!open) return
    setKind(lot?.kind ?? 'single')
    setTitle(lot?.title ?? '')
    setDescription(lot?.description ?? '')
    setStart(lot ? String(lot.starting_price) : '')
    setInc(lot ? String(lot.increment) : '5')
    setBuy(lot?.buyout_price ? String(lot.buyout_price) : '')
    setEnds(lot && lot.ends_at !== auction.ends_at ? toLocalInput(lot.ends_at) : '')
    setCards(lot?.cards ?? [])
    setErr(null)
  }, [open, lot, auction.ends_at])
  const add = (c: Card) => {
    if (cards.some((x) => x.id === c.id)) return
    const next = kind === 'single' ? [c] : [...cards, c]
    setCards(next)
    if (!title || (kind === 'single' && title === cards[0]?.title)) setTitle(kind === 'single' ? c.title : title)
  }
  const num = (s: string) => Number(s.replace(',', '.'))
  const save = async () => {
    const sp = num(start), ip = num(inc), bp = buy ? num(buy) : null
    if (!title.trim()) return setErr('Informe o nome do lote.')
    if (!(sp > 0) || !(ip > 0)) return setErr('Lance inicial e incremento precisam ser maiores que zero.')
    if (bp !== null && !(bp > sp)) return setErr('O arremate imediato precisa ser maior que o lance inicial.')
    if (kind === 'single' && cards.length !== 1) return setErr('Selecione 1 carta para o lote individual.')
    if (kind === 'combo' && cards.length < 2) return setErr('Selecione 2 ou mais cartas para o combo.')
    setBusy(true)
    setErr(null)
    try {
      await api.admin.saveLot({
        id: lot?.id, auction_id: auction.id, kind, title: title.trim(), description, starting_price: sp, increment: ip, buyout_price: bp,
        ends_at: ends ? fromLocalInput(ends) : null, position: lot?.position, card_ids: cards.map((c) => c.id),
      })
      toast({ kind: 'success', title: lot ? 'Lote atualizado' : 'Lote adicionado' })
      onSaved()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Modal open={open && !newCard} onClose={() => !busy && onClose()} title={lot ? 'Editar lote' : 'Novo lote'} size="xl" footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button><Button loading={busy} onClick={save}>Salvar lote</Button></>}>
        <div className="grid gap-6 pb-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-5">
            <ChipGroup label="Tipo de lote" value={kind} onChange={(v) => { if (v) { setKind(v); if (v === 'single') setCards((c) => c.slice(0, 1)) } }} options={[{ value: 'single', label: 'Carta individual' }, { value: 'combo', label: 'Combo (2+ cartas)' }]} />
            <Field label={kind === 'combo' ? 'Nome do combo' : 'Nome do lote'}>{(p) => <Input id={p.id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />}</Field>
            <Field label="Descrição" optional>{(p) => <Textarea id={p.id} value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" maxLength={4000} />}</Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Lance inicial">{(p) => <Input id={p.id} inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="20" className="tabular" />}</Field>
              <Field label="Incremento">{(p) => <Input id={p.id} inputMode="decimal" value={inc} onChange={(e) => setInc(e.target.value)} placeholder="5" className="tabular" />}</Field>
              <Field label="Arremate" optional>{(p) => <Input id={p.id} inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} placeholder="100" className="tabular" />}</Field>
            </div>
            <Field label="Encerramento próprio" optional hint={`Padrão: igual ao leilão (${dateTime(auction.ends_at)}).`}>{(p) => <Input id={p.id} type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} aria-describedby={p.describedBy} />}</Field>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Cartas do lote ({cards.length})</p>
              <Button size="sm" variant="ghost" onClick={() => setNewCard(true)} icon={<Plus className="size-4" />}>Cadastrar nova</Button>
            </div>
            {cards.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-[14px] text-muted">Escolha na lista abaixo ou cadastre uma nova.</p>
            ) : (
              <ul className="space-y-2">
                {cards.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-2">
                    <span className="tabular w-5 text-center text-[13px] text-subtle">{i + 1}</span>
                    <CardImage path={c.front_path} alt="" className="aspect-[5/7] w-10 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.title}</span>
                      <span className="flex gap-1.5"><LanguageTag value={c.language} className="h-6" /><ConditionTag value={c.condition} /></span>
                    </span>
                    <button type="button" onClick={() => setCards(cards.filter((x) => x.id !== c.id))} aria-label={`Remover ${c.title}`} className="rounded-lg p-2 text-subtle hover:bg-danger-soft hover:text-danger"><X className="size-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="relative mt-5">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" />
              <label htmlFor="lot-card-search" className="sr-only">Buscar cartas cadastradas</label>
              <Input id="lot-card-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cartas cadastradas" className="h-11 pl-11" />
            </div>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
              {(lib.data?.items ?? []).filter((c) => !cards.some((x) => x.id === c.id)).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => add(c)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-2">
                    <CardImage path={c.front_path} alt="" className="aspect-[5/7] w-9 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{c.title}</span>
                      <span className="block truncate text-[13px] text-subtle">{c.collection} · {c.language} · {c.condition}{c.lot_count ? ` · em ${c.lot_count} lote(s)` : ''}</span>
                    </span>
                    <Plus aria-hidden className="size-4 text-accent-text" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {err && <p role="alert" className="mb-4 rounded-2xl bg-danger-soft p-3 text-[14px] text-danger">{err}</p>}
      </Modal>
      <CardFormModal
        card={null}
        open={newCard}
        onClose={() => setNewCard(false)}
        onSaved={async (cid) => {
          setNewCard(false)
          const r = await api.admin.cards('', 200)
          const c = r.items.find((x) => x.id === cid)
          if (c) add(c)
          void lib.reload()
        }}
      />
    </>
  )
}
