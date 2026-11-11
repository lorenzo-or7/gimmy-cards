import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Heart, Search, Sparkles, X } from 'lucide-react'
import { ACCOUNT_TABS, Page, PageHeader, Tabs } from '@/components/layout/Page'
import { cx, EmptyState, ErrorState, Input, Skeleton, Switch } from '@/components/ui'
import { useAuth, useToast } from '@/app/providers'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import type { Pokemon } from '@/lib/types'

const dex = (p: Pokemon) => (p.dex ? `#${String(p.dex).padStart(4, '0')}` : '—')

export default function Favorites() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const favs = useQuery('my-favorites', api.myFavorites)
  const [q, setQ] = useState('')
  const [deb, setDeb] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setDeb(q.trim()), 220)
    return () => clearTimeout(t)
  }, [q])
  const results = useQuery(`pokemon:${deb}`, () => api.searchPokemon(deb, 24), { enabled: deb.length > 0 })
  const ids = new Set((favs.data ?? []).map((f) => f.id))

  const toggle = async (p: Pokemon) => {
    setBusy(p.id)
    try {
      if (ids.has(p.id)) await api.removeFavorite(p.id)
      else await api.addFavorite(p.id)
      await favs.reload()
      toast({ kind: 'success', title: ids.has(p.id) ? `${p.name} saiu dos favoritos` : `${p.name} adicionado aos favoritos` })
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível salvar', body: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }
  const alertsOn = profile?.notify_prefs?.favorites !== false
  const setAlerts = async (v: boolean) => {
    if (!profile) return
    try {
      await api.updateMe(profile.full_name, profile.whatsapp, { ...profile.notify_prefs, favorites: v })
      await refreshProfile()
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível salvar', body: errorMessage(e) })
    }
  }

  return (
    <Page>
      <PageHeader mascot="cartas" eyebrow="Minha conta" title="Meus favoritos">
        Escolha seus Pokémon favoritos e receba um aviso especial quando uma carta deles entrar em leilão, inclusive dentro de combos.
      </PageHeader>
      <Tabs label="Seções da conta" items={ACCOUNT_TABS} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section aria-labelledby="fav-search" className="rounded-[1.75rem] border border-line bg-surface p-5 sm:p-6">
          <h2 id="fav-search" className="text-xl">Adicionar Pokémon</h2>
          <div className="relative mt-4">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" />
            <label htmlFor="poke-q" className="sr-only">Buscar Pokémon pelo nome ou número</label>
            <Input id="poke-q" type="search" autoComplete="off" placeholder="Ex.: Pikachu, Charizard ou 25" value={q} onChange={(e) => setQ(e.target.value)} className="pl-12" />
          </div>
          <div className="mt-4 min-h-40">
            {!deb ? (
              <p className="py-8 text-center text-[15px] text-muted">Digite um nome para buscar.</p>
            ) : results.loading ? (
              <Skeleton className="h-40" />
            ) : (results.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-[15px] text-muted">Nenhum Pokémon encontrado para “{deb}”.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {results.data!.map((p) => {
                  const on = ids.has(p.id)
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => toggle(p)}
                        disabled={busy === p.id}
                        aria-pressed={on}
                        aria-label={on ? `Remover ${p.name} dos favoritos` : `Favoritar ${p.name}`}
                        className={cx('flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors disabled:opacity-60', on ? 'border-gold/50 bg-gold-soft' : 'border-line hover:border-accent/50')}
                      >
                        <span className="tabular w-12 text-[12px] font-semibold text-subtle">{dex(p)}</span>
                        <span className="flex-1 font-semibold">{p.name}</span>
                        <Heart aria-hidden className={cx('size-5 transition-transform', on ? 'scale-110 fill-current text-gold-text' : 'text-subtle')} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="fav-list" className="rounded-[1.75rem] border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="fav-list" className="text-xl">Sua lista {favs.data && <span className="tabular text-subtle">({favs.data.length})</span>}</h2>
            <label className="flex items-center gap-3 text-[14px] text-muted">
              Avisos de favoritos
              <Switch label="Avisos de Pokémon favoritos" checked={alertsOn} onChange={setAlerts} />
            </label>
          </div>
          {favs.error && <ErrorState message={favs.error} onRetry={favs.reload} />}
          {favs.loading ? (
            <Skeleton className="mt-4 h-40" />
          ) : (favs.data ?? []).length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={<Heart className="size-6" />} title="Nenhum favorito ainda">Busque um Pokémon ao lado e toque no coração.</EmptyState>
            </div>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {favs.data!.map((p) => (
                  <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                    <span className="inline-flex h-11 items-center gap-2 rounded-full border border-gold/45 bg-gold-soft pr-1.5 pl-3.5">
                      <Heart aria-hidden className="size-4 fill-current text-gold-text" />
                      <span className="font-semibold">{p.name}</span>
                      {!!p.live_lots && (
                        <Link to="/catalogo" className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[12px] font-bold text-accent-ink">
                          <Sparkles aria-hidden className="size-3" /> {p.live_lots} em leilão
                        </Link>
                      )}
                      <button type="button" onClick={() => toggle(p)} disabled={busy === p.id} aria-label={`Remover ${p.name}`} className="grid size-8 place-items-center rounded-full text-subtle hover:bg-surface hover:text-ink">
                        <X className="size-4" />
                      </button>
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          <p className="mt-5 text-[13px] text-subtle">Sua lista é privada. Avisos chegam na central de notificações, uma vez por lote.</p>
        </section>
      </div>
    </Page>
  )
}
