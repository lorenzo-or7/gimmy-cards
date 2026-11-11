import { useEffect, useState } from 'react'
import { onBoot, type BootProgress } from '@/lib/backend'

/**
 * Opening screen. The bar advances only on real initialisation stages
 * reported by the backend (no invented percentages). Before the first stage
 * is known it shows an indeterminate sweep.
 */
export function Splash({ leaving = false }: { leaving?: boolean }) {
  const [p, setP] = useState<BootProgress>({ done: 0, total: 0, label: '' })
  useEffect(() => onBoot(setP), [])
  const determinate = p.total > 0
  const pct = determinate ? Math.max(6, Math.round((p.done / p.total) * 100)) : 0
  return (
    <div
      className={`fixed inset-0 z-[200] grid place-items-center bg-[#0b1218] transition-opacity duration-500 ease-out ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      role="status"
      aria-label="Carregando Gimmy Cards"
      aria-live="polite"
    >
      <div className="flex w-[min(17rem,72vw)] flex-col items-center">
        <img src={`${import.meta.env.BASE_URL}brand/gimmy-cards-logo.webp`} alt="Gimmy Cards" width={220} height={185} className="w-[190px] select-none" draggable={false} />
        <div
          className="splash-track relative mt-9 h-[5px] w-full overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-white/[0.06]"
          role="progressbar"
          aria-label="Progresso da inicialização"
          aria-valuemin={0}
          aria-valuemax={determinate ? p.total : undefined}
          aria-valuenow={determinate ? p.done : undefined}
          aria-valuetext={p.label || undefined}
        >
          {determinate ? (
            <div className="splash-fill absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%` }} />
          ) : (
            <div className="splash-indeterminate absolute inset-y-0 w-2/5 rounded-full" />
          )}
        </div>
        <p className="mt-4 text-sm text-[#b9c6c4]">Preparando os leilões...</p>
        <p className="mt-1 h-4 text-[12px] text-[#8a9c9d]">{p.label && p.label !== 'Preparando os leilões...' ? p.label : ''}</p>
      </div>
    </div>
  )
}
