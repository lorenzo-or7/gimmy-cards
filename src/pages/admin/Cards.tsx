import { useEffect, useState } from 'react'
import { Crop, ImagePlus, Layers, Pencil, Plus, Search, Trash2, Undo2 } from 'lucide-react'
import { Button, ChipGroup, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Skeleton, Textarea } from '@/components/ui'
import { CardImage, ConditionTag, LanguageTag } from '@/components/cards/CardVisuals'
import { useBackend, useImage, useToast } from '@/app/providers'
import { CropEditor } from '@/components/cards/CropEditor'
import { useQuery } from '@/hooks/useQuery'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { CONDITIONS, LANGUAGES } from '@/lib/format'
import { assertImage, prepareCardPhoto } from '@/lib/images'
import type { Card, CardCondition, CardLanguage, Pokemon } from '@/lib/types'
import { PokemonPicker } from '@/components/cards/PokemonPicker'
import { AdminHeader } from './AdminLayout'
import { Flag } from '@/components/cards/Flag'

export default function Cards() {
  const [search, setSearch] = useState('')
  const [deb, setDeb] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDeb(search), 300)
    return () => clearTimeout(t)
  }, [search])
  const q = useQuery(`admin:cards:${deb}`, () => api.admin.cards(deb, 120))
  const [edit, setEdit] = useState<Card | 'new' | null>(null)
  const [del, setDel] = useState<Card | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return (
    <>
      <AdminHeader title="Cartas" action={<Button onClick={() => setEdit('new')} icon={<Plus className="size-4" />}>Nova carta</Button>}>
        Cadastro manual com frente, verso, coleção, idioma e condição. As fotos são otimizadas automaticamente.
      </AdminHeader>
      <div className="relative mb-6 max-w-md">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" />
        <label htmlFor="card-search" className="sr-only">Buscar carta</label>
        <Input id="card-search" type="search" placeholder="Buscar por título ou coleção" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12" />
      </div>
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : (q.data?.items ?? []).length === 0 ? (
        <EmptyState icon={<Layers className="size-6" />} title="Nenhuma carta cadastrada" action={<Button onClick={() => setEdit('new')}>Cadastrar a primeira</Button>} />
      ) : (
        <>
          <p className="mb-4 text-[14px] text-subtle">{q.data!.total} cartas</p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {q.data!.items.map((c) => (
              <li key={c.id} className="bg-surface/85 group rounded-3xl border border-line-strong p-2.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <CardImage path={c.front_path} alt={`${c.title}, frente`} className="aspect-[5/7] rounded-xl" />
                  <CardImage path={c.back_path} alt={`${c.title}, verso`} className="aspect-[5/7] rounded-xl" />
                </div>
                <p className="mt-2.5 line-clamp-1 px-1 font-semibold">{c.title}</p>
                <p className="line-clamp-1 px-1 text-[13px] text-subtle">{c.collection || '—'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
                  <LanguageTag value={c.language} />
                  <ConditionTag value={c.condition} />
                </div>
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[12px] text-subtle">{c.lot_count ? `Em ${c.lot_count} lote(s)` : 'Sem lote'}</span>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => setEdit(c)} aria-label={`Editar ${c.title}`} className="rounded-lg p-2 text-subtle hover:bg-surface-2 hover:text-ink"><Pencil className="size-4" /></button>
                    {!c.lot_count && <button type="button" onClick={() => setDel(c)} aria-label={`Excluir ${c.title}`} className="rounded-lg p-2 text-subtle hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <CardFormModal card={edit === 'new' ? null : edit} open={edit !== null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void q.reload() }} />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        loading={busy}
        tone="danger"
        title="Excluir carta?"
        description={`“${del?.title}” será removida do cadastro. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          setBusy(true)
          try {
            await api.admin.deleteCard(del!.id)
            toast({ kind: 'success', title: 'Carta excluída' })
            setDel(null)
            void q.reload()
          } catch (e) {
            toast({ kind: 'error', title: 'Não foi possível excluir', body: errorMessage(e) })
          } finally {
            setBusy(false)
          }
        }}
      />
    </>
  )
}

/**
 * Photo slot with preview, "Ajustar imagem" (crop/rotate/straighten) and
 * "Restaurar original". Reports the final file (edited or original) upward;
 * `null` means "keep the card's current image".
 */
function PhotoInput({ label, current, onFile }: { label: string; current: string | null; onFile(f: File | null): void }) {
  const img = useImage()
  const [original, setOriginal] = useState<File | null>(null)
  const [edited, setEdited] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [origUrl, setOrigUrl] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const shown = edited ?? original
  useEffect(() => {
    if (!shown) return setPreview(null)
    const u = URL.createObjectURL(shown)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [shown])
  useEffect(() => {
    if (!original) return setOrigUrl(null)
    const u = URL.createObjectURL(original)
    setOrigUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [original])
  const pick = (f: File | null) => {
    setErr(null)
    if (!f) return
    try {
      assertImage(f)
    } catch (e) {
      return setErr((e as Error).message)
    }
    setOriginal(f)
    setEdited(null)
    onFile(f)
  }
  const cropSrc = origUrl ?? img(current, 'full')
  const id = `photo-${label}`
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <label htmlFor={id} className="group relative block aspect-[5/7] cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-line-strong bg-surface-2 transition-colors hover:border-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
        {preview ? (
          <img src={preview} alt={`Prévia: ${label}`} className="size-full object-contain" />
        ) : current ? (
          <CardImage path={current} alt="" className="size-full" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-center text-[14px] text-subtle">
            <span><ImagePlus aria-hidden className="mx-auto mb-2 size-7" />Escolher foto</span>
          </span>
        )}
        {edited && <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">Ajustada</span>}
        {(preview || current) && <span className="absolute inset-x-2 bottom-2 rounded-lg bg-black/60 py-1 text-center text-[12px] text-white opacity-0 transition-opacity group-hover:opacity-100">Trocar foto</span>}
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      </label>
      {(original || current) && (
        <div className="mt-2 grid gap-1.5">
          <button type="button" onClick={() => setCropOpen(true)} className="flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-line-strong text-[13px] font-semibold hover:border-accent hover:text-accent-text">
            <Crop aria-hidden className="size-3.5" /> Ajustar imagem
          </button>
          {edited && (
            <button
              type="button"
              onClick={() => {
                setEdited(null)
                onFile(original)
              }}
              className="flex h-8 items-center justify-center gap-1.5 rounded-[10px] text-[12px] font-semibold text-muted hover:text-ink"
            >
              <Undo2 aria-hidden className="size-3.5" /> Restaurar original
            </button>
          )}
        </div>
      )}
      {err && <p role="alert" className="mt-1.5 text-[12px] font-medium text-danger">{err}</p>}
      <CropEditor
        src={cropSrc}
        title={label}
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        onApply={(blob) => {
          const f = new File([blob], `${label.toLowerCase()}.webp`, { type: 'image/webp' })
          setEdited(f)
          onFile(f)
          setCropOpen(false)
        }}
      />
    </div>
  )
}

export function CardFormModal({ card, open, onClose, onSaved }: { card: Card | null; open: boolean; onClose(): void; onSaved(id: string): void }) {
  const backend = useBackend()
  const toast = useToast()
  const [f, setF] = useState({ title: '', collection: '', language: 'BR' as CardLanguage, condition: 'NM' as CardCondition, notes: '' })
  const [pokemon, setPokemon] = useState<Pokemon[]>([])
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setPokemon(card?.pokemon ?? [])
    setF(card ? { title: card.title, collection: card.collection, language: card.language, condition: card.condition, notes: card.notes } : { title: '', collection: '', language: 'BR', condition: 'NM', notes: '' })
    setFront(null)
    setBack(null)
    setErr(null)
  }, [open, card])
  const upload = async (file: File, side: string) => {
    const { full, thumb } = await prepareCardPhoto(file)
    const folder = crypto.randomUUID()
    const path = await backend.storage.uploadCardImage(full, `${side}.webp`, folder)
    if (backend.mode === 'supabase') {
      // thumbnail lives next to the full image: "<folder>/front_thumb.webp"
      await backend.storage.uploadCardImage(thumb, `${side}_thumb.webp`, folder)
    }
    return path
  }
  const save = async () => {
    if (!f.title.trim()) return setErr('Informe o título.')
    if (!card && (!front || !back)) return setErr('Envie as fotos de frente e verso.')
    setBusy(true)
    setErr(null)
    try {
      const [front_path, back_path] = await Promise.all([front ? upload(front, 'front') : Promise.resolve(card?.front_path ?? ''), back ? upload(back, 'back') : Promise.resolve(card?.back_path ?? '')])
      const id = await api.admin.saveCard({ id: card?.id, ...f, title: f.title.trim(), front_path, back_path })
      await api.admin.setCardPokemon(id, pokemon.map((x) => x.id))
      toast({ kind: 'success', title: card ? 'Carta atualizada' : 'Carta cadastrada' })
      onSaved(id)
    } catch (e) {
      setErr(e instanceof Error && !('code' in e) ? e.message : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={card ? 'Editar carta' : 'Nova carta'} size="lg" footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button><Button loading={busy} onClick={save}>Salvar carta</Button></>}>
      <div className="grid gap-6 pb-4 sm:grid-cols-[1fr_1.3fr]">
        <div className="grid grid-cols-2 gap-3">
          <PhotoInput key={'f' + (card?.id ?? 'new') + String(open)} label="Frente" current={card?.front_path ?? null} onFile={setFront} />
          <PhotoInput key={'b' + (card?.id ?? 'new') + String(open)} label="Verso" current={card?.back_path ?? null} onFile={setBack} />
        </div>
        <div className="space-y-5">
          <Field label="Título">{(p) => <Input id={p.id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} />}</Field>
          <Field label="Coleção" optional>{(p) => <Input id={p.id} value={f.collection} onChange={(e) => setF({ ...f, collection: e.target.value })} maxLength={160} />}</Field>
          <ChipGroup label="Idioma" size="sm" value={f.language} onChange={(v) => v && setF({ ...f, language: v })} options={LANGUAGES.map((l) => ({ value: l.value, label: <><Flag lang={l.value} /> {l.label}</>, title: l.name }))} />
          <ChipGroup label="Condição" size="sm" value={f.condition} onChange={(v) => v && setF({ ...f, condition: v })} options={CONDITIONS.map((c) => ({ value: c.value, label: c.short, title: `${c.label} — ${c.hint}` }))} />
          <p className="-mt-3 text-[13px] text-subtle">{CONDITIONS.find((c) => c.value === f.condition)?.label}: {CONDITIONS.find((c) => c.value === f.condition)?.hint}</p>
          <PokemonPicker value={pokemon} onChange={setPokemon} />
          <Field label="Observações" optional>{(p) => <Textarea id={p.id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={2000} className="min-h-20" />}</Field>
        </div>
      </div>
      {err && <p role="alert" className="mb-4 rounded-2xl bg-danger-soft p-3 text-[14px] text-danger">{err}</p>}
    </Modal>
  )
}
