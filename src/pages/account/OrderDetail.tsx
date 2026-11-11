import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Copy, CreditCard, FileUp, MessageCircle, QrCode, Upload } from 'lucide-react'
import { Page } from '@/components/layout/Page'
import { Mascot } from '@/components/brand/Mascot'
import { Badge, Button, cx, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { CardImage, ConditionTag, LanguageTag } from '@/components/cards/CardVisuals'
import { useAuth, useBackend, useSettings, useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { buildPaymentMessage } from '@/lib/domain'
import { errorMessage } from '@/lib/errors'
import { dateLong, dateTime, money, whatsappShare } from '@/lib/format'
import { PROOF_MAX_BYTES, PROOF_TYPES } from '@/lib/images'
import type { Order } from '@/lib/types'
import { OrderBadge } from './MyOrders'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const q = useQuery(`order:${id}`, () => api.order(id), { live: { topic: 'notifications' } })
  if (q.error) return <Page><ErrorState message={q.error} onRetry={q.reload} /></Page>
  if (q.loading && !q.data) return <Page><Skeleton className="h-96" /></Page>
  if (!q.data) return <Page><EmptyState mascot="confused" title="Pedido não encontrado" /></Page>
  return <OrderView order={q.data} reload={q.reload} />
}

function OrderView({ order, reload }: { order: Order; reload(): void }) {
  const settings = useSettings()
  const toast = useToast()
  const [copied, setCopied] = useState<string | null>(null)
  const pix = settings?.pix_key ?? 'lojagimmycards@gmail.com'
  const card = settings?.card_link ?? 'https://mpago.la/2QfsRQH'
  const message = buildPaymentMessage(order, { pix_key: pix, card_link: card })
  const payable = order.status === 'awaiting_payment' || order.status === 'proof_submitted'
  const items = order.items.filter((i) => i.status === 'active')

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
      toast({ kind: 'success', title: 'Copiado!' })
    } catch {
      toast({ kind: 'error', title: 'Não foi possível copiar', body: 'Selecione o texto e copie manualmente.' })
    }
  }

  const steps = [
    { k: 'created', t: 'Pedido criado', done: true },
    { k: 'proof', t: 'Comprovante enviado', done: order.proofs.length > 0 || order.status === 'paid' },
    { k: 'paid', t: 'Pagamento confirmado', done: order.status === 'paid' },
  ]

  return (
    <Page>
      <Link to="/conta/pedidos" className="mb-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Meus pedidos
      </Link>
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderBadge o={order} />
            {order.source === 'transfer' && <Badge tone="gold">Oferta por inadimplência</Badge>}
          </div>
          <h1 className="tabular mt-3 text-4xl sm:text-5xl">Pedido #{order.code}</h1>
          <p className="mt-2 text-lg text-muted">{order.auction_title}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-subtle">Total</p>
          <p className="tabular text-4xl font-bold">{money(order.total)}</p>
        </div>
      </header>

      <ol className="mb-10 grid grid-cols-3 gap-2" aria-label="Andamento do pedido">
        {steps.map((s, i) => (
          <li key={s.k} className={cx('rounded-2xl border p-3 text-[14px] sm:p-4', s.done ? 'border-accent/40 bg-accent-soft' : 'border-line')}>
            <span className={cx('mb-2 grid size-7 place-items-center rounded-full text-[13px] font-bold', s.done ? 'bg-accent text-accent-ink' : 'bg-surface-3 text-subtle')}>
              {s.done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cx('font-medium', !s.done && 'text-subtle')}>{s.t}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section aria-labelledby="items-title">
          <h2 id="items-title" className="mb-4 text-xl">Itens</h2>
          <ul className="divide-y divide-line rounded-3xl border border-line bg-surface">
            {items.map((it) => (
              <li key={it.id} className="flex gap-4 p-4">
                <CardImage path={it.lot.cards[0]?.front_path ?? null} alt="" className="aspect-[5/7] w-16 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Link to={`/lote/${it.lot.id}`} className="font-semibold hover:text-accent-text">{it.lot.title}</Link>
                  {it.lot.kind === 'single' && it.lot.cards[0] ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <LanguageTag value={it.lot.cards[0].language} />
                      <ConditionTag value={it.lot.cards[0].condition} />
                    </div>
                  ) : (
                    <p className="mt-1 text-[14px] text-subtle">Combo · {it.lot.card_count} cartas: {it.lot.cards.map((c) => `${c.title} (${c.condition}, ${c.language})`).join(', ')}</p>
                  )}
                </div>
                <span className="tabular font-bold">{money(it.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between p-4 text-lg font-bold">
              <span>Total</span>
              <span className="tabular">{money(order.total)}</span>
            </li>
          </ul>
          {order.status === 'paid' && (
            <div className="mt-4 flex items-center gap-4 rounded-2xl bg-success-soft p-4 text-[15px]">
              <Mascot pose="celebrating" width={60} motion="pop" className="hidden sm:block" />
              <p>
                <strong className="font-semibold">Pagamento confirmado.</strong> Pago em {dateTime(order.paid_at)}. Suas cartas estão em <Link to="/conta/armazenadas" className="font-semibold text-accent-text underline">Cartas armazenadas</Link>: peça envio, retirada ou deixe guardado.
              </p>
            </div>
          )}
          {order.status === 'defaulted' && <p className="mt-4 rounded-2xl bg-danger-soft p-4 text-[15px] text-danger">Este pedido foi encerrado por falta de pagamento. {order.admin_note}</p>}
        </section>

        {payable && (
          <section aria-labelledby="pay-title" className="space-y-5">
            <div className="rounded-[1.75rem] border border-line-strong bg-surface p-6">
              <h2 id="pay-title" className="text-xl">Como pagar</h2>
              <p className={cx('mt-1 text-[15px]', order.overdue ? 'font-semibold text-danger' : 'text-muted')}>
                {order.overdue ? 'O prazo venceu em ' : 'Prazo: '}
                {dateLong(order.due_at)} (Brasília)
              </p>
              <div className="mt-5 space-y-3">
                <PayRow icon={<QrCode className="size-5" />} label="PIX (chave e-mail)" value={pix} action={<Button size="sm" variant="secondary" onClick={() => copy(pix, 'pix')} icon={copied === 'pix' ? <Check className="size-4" /> : <Copy className="size-4" />}>{copied === 'pix' ? 'Copiado' : 'Copiar'}</Button>} />
                <PayRow icon={<CreditCard className="size-5" />} label="Cartão (Mercado Pago)" value={card} action={<a href={card} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-ink">Pagar</a>} />
              </div>
              <p className="mt-4 text-[14px] text-subtle">Pague o valor total ({money(order.total)}). Depois envie o comprovante abaixo. A confirmação é feita pela equipe.</p>
            </div>
            <ProofUpload order={order} onDone={reload} />
            <div className="rounded-[1.75rem] border border-line bg-surface p-6">
              <h2 className="text-lg">Resumo para enviar ou guardar</h2>
              <pre className="mt-3 max-h-60 overflow-auto rounded-2xl bg-bg p-4 font-sans text-[14px] whitespace-pre-wrap text-muted">{message}</pre>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => copy(message, 'msg')} icon={<Copy className="size-4" />}>Copiar resumo</Button>
                <a href={whatsappShare(message)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-line-strong px-5 font-semibold hover:border-accent">
                  <MessageCircle aria-hidden className="size-4" /> Compartilhar no WhatsApp
                </a>
              </div>
            </div>
          </section>
        )}
      </div>
    </Page>
  )
}

function PayRow({ icon, label, value, action }: { icon: React.ReactNode; label: string; value: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg p-3.5">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-subtle">{label}</p>
        <p className="truncate font-semibold">{value}</p>
      </div>
      {action}
    </div>
  )
}

function ProofUpload({ order, onDone }: { order: Order; onDone(): void }) {
  const backend = useBackend()
  const { session } = useAuth()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pick = (f: File | undefined) => {
    setError(null)
    if (!f) return
    if (!PROOF_TYPES.includes(f.type)) return setError('Envie uma imagem (JPG, PNG, WebP) ou PDF.')
    if (f.size > PROOF_MAX_BYTES) return setError('O arquivo passa de 10 MB.')
    setFile(f)
  }
  const send = async () => {
    if (!file || !session) return
    setBusy(true)
    try {
      const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1].replace('jpeg', 'jpg')
      const path = await backend.storage.uploadProof(session.userId, order.id, file, ext)
      await api.submitProof(order.id, path)
      setFile(null)
      toast({ kind: 'success', title: 'Comprovante enviado', body: 'A equipe vai conferir e confirmar o pagamento.' })
      onDone()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-[1.75rem] border border-line bg-surface p-6">
      <h2 className="text-lg">Comprovante</h2>
      <p className="mt-1 text-[14px] text-muted">Arquivo privado: só você e a equipe podem ver.</p>
      {order.proofs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {order.proofs.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-bg px-3 py-2 text-[14px]">
              <span>Enviado {dateTime(p.created_at)}</span>
              <Badge tone={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'accent'}>
                {p.status === 'approved' ? 'Aprovado' : p.status === 'rejected' ? 'Recusado' : 'Em análise'}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {order.proofs.some((p) => p.status === 'rejected' && p.review_note) && (
        <p className="mt-3 rounded-xl bg-danger-soft p-3 text-[14px] text-danger">Observação da equipe: {order.proofs.find((p) => p.status === 'rejected')?.review_note}</p>
      )}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          pick(e.dataTransfer.files[0])
        }}
        className="mt-4 rounded-2xl border-2 border-dashed border-line-strong p-5 text-center"
      >
        <FileUp aria-hidden className="mx-auto size-7 text-subtle" />
        <p className="mt-2 text-[15px]">{file ? <strong>{file.name}</strong> : 'Arraste o arquivo ou escolha no aparelho'}</p>
        <input ref={input} type="file" accept={PROOF_TYPES.join(',')} className="sr-only" id="proof-file" onChange={(e) => pick(e.target.files?.[0])} />
        <label htmlFor="proof-file" className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-xl border border-line-strong px-4 text-sm font-semibold hover:border-accent">
          Escolher arquivo
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-[14px] font-medium text-danger">{error}</p>}
      <Button className="mt-4 w-full" disabled={!file} loading={busy} onClick={send} icon={<Upload className="size-4" />}>Enviar comprovante</Button>
    </div>
  )
}
