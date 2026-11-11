import { useEffect, useId, useState } from 'react'
import { Plus, Search, Sparkles, X } from 'lucide-react'
import { cx, Input } from '@/components/ui'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import type { Pokemon } from '@/lib/types'

/** Standardised Pokémon selection for a card (search + chips). Admins can add missing species. */
export function PokemonPicker({ value, onChange }: { value: Pokemon[]; onChange(v: Pokemon[]): void }) {
  const id = useId()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Pokemon[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    const term = q.trim()
    if (!term) return setResults([])
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      api.searchPokemon(term, 8)
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false))
    }, 200)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])
  const picked = new Set(value.map((p) => p.id))
  const add = (p: Pokemon) => {
    if (!picked.has(p.id)) onChange([...value, p])
    setQ('')
  }
  const exact = results.some((r) => r.name.toLowerCase() === q.trim().toLowerCase())
  const create = async () => {
    setErr(null)
    try {
      const name = q.trim()
      const newId = await api.admin.addPokemon(name, null)
      add({ id: newId, dex: null, name })
    } catch (e) {
      setErr(errorMessage(e))
    }
  }
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">Pokémon da carta <span className="font-normal text-subtle">(opcional)</span></label>
      <p className="text-[13px] text-subtle">Usado para avisar quem tem esse Pokémon nos favoritos.</p>
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((p) => (
            <li key={p.id} className="inline-flex h-8 items-center gap-1 rounded-full border border-gold/40 bg-gold-soft pr-1 pl-2.5 text-[13px] font-medium">
              <Sparkles aria-hidden className="size-3 text-gold-text" /> {p.name}
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== p.id))} aria-label={`Remover ${p.name}`} className="grid size-6 place-items-center rounded-full hover:bg-surface">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative mt-2">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" />
        <Input id={id} type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou número" className="h-11 pl-11" />
      </div>
      {q.trim() && (
        <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-line bg-surface p-1">
          {loading && <li className="px-3 py-2 text-[13px] text-subtle">Buscando…</li>}
          {!loading && results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => add(p)} disabled={picked.has(p.id)} className={cx('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] hover:bg-surface-2 disabled:opacity-40')}>
                <span className="tabular w-12 text-[12px] text-subtle">{p.dex ? `#${p.dex}` : '—'}</span>
                <span className="flex-1 font-medium">{p.name}</span>
                <Plus aria-hidden className="size-4 text-accent-text" />
              </button>
            </li>
          ))}
          {!loading && !exact && q.trim().length >= 2 && (
            <li>
              <button type="button" onClick={create} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] font-semibold text-accent-text hover:bg-surface-2">
                <Plus aria-hidden className="size-4" /> Adicionar “{q.trim()}” ao catálogo
              </button>
            </li>
          )}
        </ul>
      )}
      {err && <p role="alert" className="mt-1.5 text-[13px] text-danger">{err}</p>}
    </div>
  )
}
