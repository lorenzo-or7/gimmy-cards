import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { RotateCcw, RotateCw, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button, ChipGroup, cx, Modal } from '@/components/ui'

/**
 * Card photo editor: drag, zoom (also below 100% so card borders are never
 * forced out), 90° rotation plus fine straightening, suggested 5:7 card ratio
 * or the photo's own ratio. Output keeps the source resolution (capped at
 * 2000px on the long side, never upscaled) as WebP.
 */
const CARD = 5 / 7

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'))
    img.src = src // browsers apply EXIF orientation to decoded <img> and canvas draws
  })
}

export async function cropImage(src: string, area: Area, rotation: number, maxSide = 2000): Promise<Blob> {
  const img = await loadImage(src)
  const rad = (rotation * Math.PI) / 180
  const w = img.naturalWidth
  const h = img.naturalHeight
  const bw = Math.abs(Math.cos(rad) * w) + Math.abs(Math.sin(rad) * h)
  const bh = Math.abs(Math.sin(rad) * w) + Math.abs(Math.cos(rad) * h)
  // 1) rotate the whole photo inside its bounding box (react-easy-crop's coordinate space)
  const rot = document.createElement('canvas')
  rot.width = Math.round(bw)
  rot.height = Math.round(bh)
  const rc = rot.getContext('2d')!
  rc.imageSmoothingQuality = 'high'
  rc.translate(bw / 2, bh / 2)
  rc.rotate(rad)
  rc.drawImage(img, -w / 2, -h / 2)
  // 2) cut the selected area (may extend past the photo when zoomed out)
  const scale = Math.min(1, maxSide / Math.max(area.width, area.height))
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(area.width * scale))
  out.height = Math.max(1, Math.round(area.height * scale))
  const oc = out.getContext('2d')!
  oc.imageSmoothingQuality = 'high'
  oc.drawImage(rot, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height)
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', 0.92))
  if (!blob) throw new Error('Não foi possível gerar a imagem recortada.')
  return blob
}

export function CropEditor({ src, title, open, onClose, onApply }: { src: string | null; title: string; open: boolean; onClose(): void; onApply(blob: Blob): void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [quarter, setQuarter] = useState(0)
  const [fine, setFine] = useState(0)
  const [ratio, setRatio] = useState<'card' | 'photo'>('card')
  const [photoAspect, setPhotoAspect] = useState(CARD)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const reset = useCallback(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setQuarter(0)
    setFine(0)
  }, [])
  useEffect(() => {
    if (open) {
      reset()
      setErr(null)
      setRatio('card')
    }
  }, [open, src, reset])
  const rotation = quarter * 90 + fine
  const apply = async () => {
    if (!src || !area) return
    setBusy(true)
    setErr(null)
    try {
      onApply(await cropImage(src, area, rotation))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={`Ajustar imagem · ${title}`}
      description="Arraste para enquadrar, use o zoom e endireite a foto. As bordas da carta devem ficar visíveis."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={reset} icon={<Undo2 aria-hidden className="size-4" />} disabled={busy}>Restaurar ajustes</Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={apply} loading={busy} disabled={!area}>Aplicar recorte</Button>
        </>
      }
    >
      {src && (
        <div className="space-y-5 pb-4">
          <div className="relative h-[min(38dvh,300px)] sm:h-[min(56dvh,460px)] overflow-hidden rounded-2xl bg-[#05090c] [background-image:repeating-conic-gradient(#0e1a20_0_25%,#0a1317_0_50%)] [background-size:20px_20px]">
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={ratio === 'card' ? CARD : photoAspect}
              minZoom={0.5}
              maxZoom={5}
              zoomSpeed={0.15}
              restrictPosition={false}
              objectFit="contain"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setArea(px)}
              onMediaLoaded={(m) => setPhotoAspect(m.naturalWidth / m.naturalHeight)}
              classes={{ cropAreaClassName: '!border-2 !border-accent !rounded-[10px]' }}
            />
          </div>
          <div className="grid gap-5 md:grid-cols-[auto_1fr]">
            <ChipGroup
              label="Proporção"
              size="sm"
              value={ratio}
              onChange={(v) => v && setRatio(v)}
              options={[{ value: 'card', label: 'Carta 5:7' }, { value: 'photo', label: 'Foto original' }]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Slider label="Zoom" value={zoom} min={0.5} max={5} step={0.01} onChange={setZoom} format={(v) => `${Math.round(v * 100)}%`} icons={[ZoomOut, ZoomIn]} />
              <Slider label="Endireitar" value={fine} min={-45} max={45} step={0.5} onChange={setFine} format={(v) => `${v > 0 ? '+' : ''}${v}°`} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Girar</span>
            <Button size="sm" variant="secondary" onClick={() => setQuarter((q) => q - 1)} icon={<RotateCcw aria-hidden className="size-4" />}>90° esquerda</Button>
            <Button size="sm" variant="secondary" onClick={() => setQuarter((q) => q + 1)} icon={<RotateCw aria-hidden className="size-4" />}>90° direita</Button>
          </div>
          {err && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-[14px] text-danger">{err}</p>}
        </div>
      )}
    </Modal>
  )
}

function Slider({ label, value, min, max, step, onChange, format, icons }: { label: string; value: number; min: number; max: number; step: number; onChange(v: number): void; format(v: number): string; icons?: [typeof ZoomIn, typeof ZoomIn] }) {
  const [A, B] = icons ?? []
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        <span className="tabular text-[13px] font-normal text-subtle">{format(value)}</span>
      </span>
      <span className="mt-2 flex items-center gap-2">
        {A && <A aria-hidden className="size-4 shrink-0 text-subtle" />}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cx('h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--accent)]')}
        />
        {B && <B aria-hidden className="size-4 shrink-0 text-subtle" />}
      </span>
    </label>
  )
}
