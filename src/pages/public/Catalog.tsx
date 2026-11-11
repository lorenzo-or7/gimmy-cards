import { useEffect, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Page, PageHeader } from '@/components/layout/Page'
import { LotGridSkeleton, LotTile } from '@/components/auction/LotTile'
import { Button, ChipGroup, EmptyState, ErrorState, Input } from '@/components/ui'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { CONDITIONS, LANGUAGES } from '@/lib/format'
import type { CardCondition, CardLanguage, Lot, LotKind } from '@/lib/types'
import { Flag } from '@/components/cards/Flag'

const PAGE = 16

export default function Catalog() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [language, setLanguage] = useState<CardLanguage | null>(null)
  const [condition, setCondition] = useState<CardCondition | null>(null)
  const [kind, setKind] = useState<LotKind | null>(null)
  const [extra, setExtra] = useState<Lot[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const key = `catalog:${debounced}:${language}:${condition}:${kind}`
  const q = useQuery(key, () => api.catalog({ search: debounced, language, condition, kind, limit: PAGE }))
  useEffect(() => setExtra([]), [key])
  const items = [...(q.data?.items ?? []), ...extra]
  const total = q.data?.total ?? 0

  const more = async () => {
    setLoadingMore(true)
    try {
      const r = await api.catalog({ search: debounced, language, condition, kind, limit: PAGE, offset: items.length })
      setExtra((x) => [...x, ...r.items])
    } finally {
      setLoadingMore(false)
    }
  }
  const activeFilters = [language, condition, kind].filter(Boolean).length

  return (
    <Page>
      <PageHeader mascot="cartas" eyebrow="Catálogo" title="Cartas em leilão">
        Tudo o que está aberto ou prestes a abrir. Filtre por idioma, condição ou tipo de lote.
      </PageHeader>
      <div className="mb-8 rounded-[1.75rem] border border-line bg-surface p-4 sm:p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" />
            <label htmlFor="cat-search" className="sr-only">Buscar por nome ou coleção</label>
            <Input id="cat-search" type="search" placeholder="Buscar por nome ou coleção" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12" />
          </div>
          <Button variant="secondary" className="h-12 md:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} icon={<SlidersHorizontal aria-hidden className="size-4" />}>
            Filtros{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
        </div>
        <div className={`mt-5 grid gap-5 md:grid-cols-[auto_1fr_auto] ${filtersOpen ? '' : 'hidden md:grid'}`}>
          <ChipGroup label="Idioma" size="sm" allowEmpty value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l.value, label: <><Flag lang={l.value} /> {l.label}</>, title: l.name }))} />
          <ChipGroup label="Condição" size="sm" allowEmpty value={condition} onChange={setCondition} options={CONDITIONS.map((c) => ({ value: c.value, label: c.short, title: c.label }))} />
          <ChipGroup label="Tipo" size="sm" allowEmpty value={kind} onChange={setKind} options={[{ value: 'single', label: 'Individual' }, { value: 'combo', label: 'Combo' }]} />
        </div>
      </div>
      <p className="mb-5 text-[15px] text-subtle" aria-live="polite">{q.loading ? 'Buscando…' : `${total} ${total === 1 ? 'lote encontrado' : 'lotes encontrados'}`}</p>
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? (
        <LotGridSkeleton n={8} />
      ) : items.length === 0 ? (
        <EmptyState mascot="confused" icon={<Search className="size-6" />} title="Nenhuma carta com esses filtros">
          Tente outro termo ou limpe os filtros.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {items.map((l, i) => <LotTile key={l.id} lot={l} startsAt={l.auction_starts_at} index={i % PAGE} />)}
        </div>
      )}
      {items.length < total && (
        <div className="mt-10 flex justify-center">
          <Button variant="outline" loading={loadingMore} onClick={more}>Carregar mais</Button>
        </div>
      )}
    </Page>
  )
}
