import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBackend } from '@/app/providers'
import type { DemoAccount } from '@/lib/backend'
import { BadgeCheck, ChevronDown, ShieldCheck } from 'lucide-react'

/**
 * Auth layout: brand panel (owner's gradient atmosphere + mascot) beside a
 * focused form card. Safety notes are informative only: no fake seals, no
 * claims about the connection.
 */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="shell pt-24 pb-28 lg:pt-28 lg:pb-12">
      <div className="mx-auto grid max-w-[1120px] overflow-hidden rounded-[32px] border border-line-strong bg-bg-elevated shadow-pop lg:min-h-[640px] lg:grid-cols-[1fr_1.05fr]">
        <aside className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-10">
          <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-60 [mask-image:linear-gradient(160deg,black_20%,transparent_85%)]" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}brand/atmosfera.webp)` }} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-bg-elevated via-bg-elevated/40 to-transparent" />
          <div className="relative">
            <p className="t-eyebrow">Gimmy Cards</p>
            <p className="mt-3 max-w-sm text-[2.2rem] leading-[1.05] font-bold">Lances organizados, resultado na hora.</p>
          </div>
          <img src={`${import.meta.env.BASE_URL}mascot/animado.webp`} alt="" aria-hidden width={896} height={1414} className="relative mx-auto my-6 h-auto w-[210px] select-none" draggable={false} />
          <ul className="relative space-y-2.5 text-[15px] text-muted">
            {['Fotos de frente e verso de cada carta', 'Empates decididos pela ordem de registro', 'Pedidos e entregas acompanhados por aqui'].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <BadgeCheck aria-hidden className="size-4 shrink-0 text-accent-text" /> {t}
              </li>
            ))}
          </ul>
        </aside>
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-[400px]">
            <h1 className="t-h2">{title}</h1>
            {subtitle && <div className="mt-2 text-[15px] text-muted">{subtitle}</div>}
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-5 text-center text-[15px] text-muted">{footer}</div>}
            <SafetyNotes />
          </div>
        </div>
      </div>
    </div>
  )
}

function SafetyNotes() {
  return (
    <details className="group mt-7 rounded-2xl border border-line bg-surface/60 px-4 py-3 text-[13.5px] text-muted">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <ShieldCheck aria-hidden className="size-4 text-accent-text" /> Proteja sua conta
        <ChevronDown aria-hidden className="ml-auto size-4 text-subtle transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-3 space-y-2">
        <li>Use uma senha só sua, que você não usa em outros sites.</li>
        <li>A equipe Gimmy Cards nunca pede sua senha pelo WhatsApp ou por e-mail.</li>
        <li>Esqueceu a senha? Use <Link to="/recuperar-senha" className="font-medium text-accent-text underline">recuperar senha</Link>: o link chega no seu e-mail.</li>
        <li>Saiba como tratamos seus dados na <Link to="/privacidade" className="font-medium text-accent-text underline">política de privacidade</Link>.</li>
      </ul>
    </details>
  )
}

export function DemoAccounts({ onDone }: { onDone(): void }) {
  const backend = useBackend()
  const [list, setList] = useState<DemoAccount[]>([])
  useEffect(() => {
    if (backend.auth.demoAccounts) void backend.auth.demoAccounts().then(setList)
  }, [backend])
  if (backend.mode !== 'demo' || !list.length) return null
  return (
    <div className="mt-6 rounded-2xl border border-gold/40 bg-gold-soft p-4">
      <p className="text-sm font-semibold text-gold-text">Modo demonstração · entrar sem senha como:</p>
      <div className="mt-3 grid gap-2">
        {list.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={async () => {
              await backend.auth.signInAs!(a.id)
              onDone()
            }}
            className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-left hover:border-accent"
          >
            <span className="block text-[15px] font-medium">{a.label}</span>
            <span className="block text-[13px] text-subtle">{a.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export const authLink = (to: string, label: string) => (
  <Link to={to} className="font-semibold text-accent-text hover:underline">
    {label}
  </Link>
)
