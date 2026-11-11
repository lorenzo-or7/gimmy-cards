import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import { Page } from '@/components/layout/Page'
import { LotGridSkeleton, LotTile } from '@/components/auction/LotTile'
import { Badge, Button, ChipGroup, Countdown, EmptyState, ErrorState, LiveBadge } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { useNowAt } from '@/hooks/useNow'
import { useToast } from '@/app/providers'
import { api } from '@/lib/api'
import { dateLong, whatsappShare } from '@/lib/format'

export default function AuctionDetail() {
  const { id = '' } = useParams()
  const q = useQuery(`auction:${id}`, () => api.auction(id), { live: { topic: 'lots' }, poll: 30_000 })
  const now = useNowAt([q.data?.starts_at, q.data?.ends_at])
  const toast = useToast()
  const [kind, setKind] = useState<'single' | 'combo' | null>(null)
  const a = q.data
  const lots = useMemo(() => (a?.lots ?? []).filter((l) => !kind || l.kind === kind), [a, kind])
  if (q.error) return <Page><ErrorState message={q.error} onRetry={q.reload} /></Page>
  if (q.loading && !a) return <Page><div className="skeleton mb-10 h-28 rounded-3xl" /><LotGridSkeleton n={8} /></Page>
  if (!a) return <Page><EmptyState mascot="confused" title="Leilão não encontrado">Ele pode ter sido removido ou ainda não foi publicado.</EmptyState></Page>
  const started = new Date(a.starts_at).getTime() <= now
  const ended = new Date(a.ends_at).getTime() <= now || a.status === 'closed'
  const share = async () => {
    const text = `${a.title} na Gimmy Cards — ${a.lot_count} lotes. ${location.href}`
    if (navigator.share) await navigator.share({ title: a.title, text, url: location.href }).catch(() => {})
    else {
      window.open(whatsappShare(text), '_blank', 'noopener')
      toast({ kind: 'info', title: 'Abrindo o WhatsApp para compartilhar' })
    }
  }
  return (
    <Page>
      <header className="mb-12 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {ended ? <Badge>Encerrado</Badge> : started ? <LiveBadge /> : <Badge>Em breve</Badge>}
            <Badge>{a.lot_count} lotes</Badge>
            <Badge>{a.bid_count} lances</Badge>
          </div>
          <h1 className="text-4xl leading-[1.04] sm:text-6xl">{a.title}</h1>
          {a.description && <p className="mt-3 max-w-2xl text-lg text-muted">{a.description}</p>}
          <p className="mt-3 text-[15px] text-subtle">
            {dateLong(a.starts_at)} → {dateLong(a.ends_at)} · horário de Brasília
          </p>
        </div>
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
          {!ended && (
            <div>
              <p className="mb-1 text-sm text-subtle">{started ? 'Encerra em' : 'Começa em'}</p>
              <Countdown to={started ? a.ends_at : a.starts_at} />
            </div>
          )}
          <Button variant="secondary" onClick={share} icon={<Share2 aria-hidden className="size-4" />}>
            Compartilhar
          </Button>
        </div>
      </header>
      <div className="mb-6">
        <ChipGroup
          label="Filtrar lotes"
          size="sm"
          allowEmpty
          value={kind}
          onChange={setKind}
          options={[{ value: 'single', label: 'Cartas individuais' }, { value: 'combo', label: 'Combos' }]}
        />
      </div>
      {lots.length === 0 ? (
        <EmptyState mascot="confused" title="Nenhum lote neste filtro" />
      ) : (
        <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {lots.map((l, i) => <LotTile key={l.id} lot={l} startsAt={a.starts_at} index={i} />)}
        </div>
      )}
    </Page>
  )
}
