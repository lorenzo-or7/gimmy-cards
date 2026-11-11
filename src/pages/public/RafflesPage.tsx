import { Gift, Info, Users } from 'lucide-react'
import { Page, PageHeader } from '@/components/layout/Page'
import { RaffleGrid } from './home/Raffles'
import { INSTAGRAM_URL, WHATSAPP_GROUP_URL } from '@/lib/community'

export default function RafflesPage() {
  return (
    <Page>
      <PageHeader
        mascot="voando"
        eyebrow="Sorteios"
        title="Sorteios da comunidade"
        action={
          <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-[14px] bg-ink px-5 font-semibold text-bg transition-transform active:scale-[.98]">
            <Users aria-hidden className="size-[18px]" /> Entrar no grupo
            <span className="sr-only">(abre o WhatsApp em nova aba)</span>
          </a>
        }
      >
        Prêmios oficiais da coleção de 30 anos, um para cada marco de membros do grupo da Gimmy Cards no WhatsApp.
      </PageHeader>
      <RaffleGrid large />
      <div className="mt-10 flex gap-3 rounded-2xl border border-line bg-surface p-5 text-[15px] text-muted">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-text" />
        <p>
          Os anúncios, regras de participação e resultados de cada sorteio são feitos no{' '}
          <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline">grupo oficial</a> e no{' '}
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline">Instagram @gimmycards</a>. Esta página mostra apenas os marcos e os prêmios.
        </p>
      </div>
      <p className="mt-6 inline-flex items-center gap-2 text-[13px] text-subtle">
        <Gift aria-hidden className="size-4" /> Imagens oficiais fornecidas pela Gimmy Cards.
      </p>
    </Page>
  )
}
