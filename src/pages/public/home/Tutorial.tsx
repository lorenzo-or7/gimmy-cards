import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowLeft, ArrowRight, BadgeCheck, BellRing, CheckCircle2, Gavel, HandCoins, PackageCheck, RefreshCw, RotateCcw, ShieldCheck,
  Timer, Truck, UserPlus, Warehouse, Zap,
} from 'lucide-react'
import { ButtonLink, cx } from '@/components/ui'
import { Mascot } from '@/components/brand/Mascot'
import { money } from '@/lib/format'

type Step = { icon: typeof Timer; t: string; short: string; body: () => ReactNode }

const STEPS: Step[] = [
  { icon: UserPlus, t: 'Criar conta', short: 'Nome, e-mail e WhatsApp. Uma vez só.', body: () => <AccountStep /> },
  { icon: Gavel, t: 'Oferecer lance', short: 'Revise o lote e confirme o valor.', body: () => <BidStep /> },
  { icon: BellRing, t: 'Acompanhar a disputa', short: 'Avisos de lance superado e de fim próximo.', body: () => <FollowStep /> },
  { icon: PackageCheck, t: 'Pagar e receber', short: 'Até segunda, às 18h. Envio, retirada ou guarda.', body: () => <PayStep /> },
]

export function Tutorial() {
  const [active, setActive] = useState(0)
  const reduce = useReducedMotion()
  const S = STEPS[active]
  const go = (i: number) => setActive(Math.max(0, Math.min(STEPS.length - 1, i)))
  return (
    <section id="como-participar" aria-labelledby="tut-title" className="relative scroll-mt-24 border-y border-line bg-bg-elevated">
      <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 lg:py-24">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-3xl items-end gap-6">
            <Mascot pose="animado" width={112} className="-mb-3 hidden md:block" />
            <div>
            <p className="mb-2.5 text-[13px] font-semibold tracking-[0.14em] text-accent-text uppercase">Como participar?</p>
            <h2 id="tut-title" className="text-[clamp(2rem,calc(1.3rem_+_2.4vw),3.1rem)] leading-[1.05]">Do primeiro lance à carta na sua pasta.</h2>
            <p className="mt-3 text-[17px] text-muted">Crie a conta, dê seu lance, acompanhe e pague até segunda às 18h. Cada etapa explicada abaixo.</p>
            </div>
          </div>
          <ButtonLink to="/regras" variant="outline" icon={<ShieldCheck aria-hidden className="size-4" />}>Regras completas</ButtonLink>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[19rem_1fr] lg:gap-8">
          {/* step list: always readable, also works as tabs */}
          <div role="tablist" aria-label="Etapas" aria-orientation="vertical" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {STEPS.map((s, i) => {
              const on = i === active
              return (
                <button
                  key={s.t}
                  role="tab"
                  id={`step-tab-${i}`}
                  aria-selected={on}
                  aria-controls="step-panel"
                  type="button"
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => {
                    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : null
                    if (next === null || next < 0 || next >= STEPS.length) return
                    e.preventDefault()
                    go(next)
                    document.getElementById(`step-tab-${next}`)?.focus()
                  }}
                  tabIndex={on ? 0 : -1}
                  className={cx(
                    'group relative flex min-w-[13.5rem] shrink-0 items-start gap-3.5 rounded-2xl border p-3.5 text-left transition-[border-color,background-color] duration-300 lg:min-w-0',
                    on ? 'border-accent/45 bg-surface shadow-soft' : 'border-transparent hover:border-line hover:bg-surface/60',
                  )}
                >
                  <span className={cx('relative grid size-11 shrink-0 place-items-center rounded-xl transition-colors', on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-accent-text')}>
                    <s.icon aria-hidden className="size-5" />
                    <span className={cx('tabular absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full text-[11px] font-bold ring-2 ring-bg-elevated', on ? 'bg-ink text-bg' : 'bg-surface-3 text-ink')}>{i + 1}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{s.t}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-subtle">{s.short}</span>
                  </span>
                  {on && <motion.span layoutId="step-bar" aria-hidden className="absolute bottom-2 left-3.5 h-[3px] w-8 rounded-full bg-accent lg:top-1/2 lg:bottom-auto lg:-left-px lg:h-8 lg:w-[3px] lg:-translate-y-1/2" />}
                </button>
              )
            })}
          </div>

          <div id="step-panel" role="tabpanel" aria-labelledby={`step-tab-${active}`} className="relative overflow-hidden rounded-[1.75rem] border border-line-strong bg-bg p-5 shadow-pop sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-subtle">Etapa {active + 1} de {STEPS.length}</p>
              <div className="flex h-1.5 w-32 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${((active + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.4 }} />
              </div>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={reduce ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -18 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <h3 className="text-2xl">{S.t}</h3>
                <div className="mt-4">{S.body()}</div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
              <button type="button" onClick={() => go(active - 1)} disabled={active === 0} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                <ArrowLeft aria-hidden className="size-4" /> Anterior
              </button>
              {active < STEPS.length - 1 ? (
                <button type="button" onClick={() => go(active + 1)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-bg transition-transform active:scale-[.97]">
                  Próxima etapa <ArrowRight aria-hidden className="size-4" />
                </button>
              ) : (
                <Link to="/cadastro" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink">
                  Criar minha conta <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Points({ items }: { items: { icon: typeof Timer; t: string; d: string }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((r) => (
        <li key={r.t} className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-text">
            <r.icon aria-hidden className="size-[17px]" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{r.t}</span>
            <span className="mt-0.5 block text-[13.5px] leading-relaxed text-muted">{r.d}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function AccountStep() {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_15rem] md:items-center">
      <Points
        items={[
          { icon: UserPlus, t: 'Cadastro rápido', d: 'Nome completo, e-mail, WhatsApp e senha.' },
          { icon: BadgeCheck, t: 'Confirme o e-mail', d: 'Você recebe um link para ativar a conta.' },
          { icon: BellRing, t: 'Avisos do seu jeito', d: 'Escolha quais notificações quer receber.' },
          { icon: ShieldCheck, t: 'Seus dados protegidos', d: 'No quadro de lances aparece só “Maria S.”.' },
        ]}
      />
      <div aria-hidden className="hidden rounded-2xl border border-line bg-surface p-4 md:block">
        {['Nome completo', 'E-mail', 'WhatsApp'].map((f) => (
          <div key={f} className="mb-3">
            <div className="mb-1 h-2 w-16 rounded bg-surface-3" />
            <div className="h-8 rounded-lg border border-line-strong bg-bg" />
          </div>
        ))}
        <div className="h-9 rounded-lg bg-accent" />
      </div>
    </div>
  )
}

function BidStep() {
  return (
    <Points
      items={[
        { icon: HandCoins, t: 'Incremento', d: 'Para passar o maior lance, some o incremento do lote. O primeiro lance começa no valor inicial.' },
        { icon: Timer, t: 'Valores iguais valem', d: 'Repetir um valor já oferecido é permitido: você fica logo atrás de quem registrou antes.' },
        { icon: BadgeCheck, t: 'Confirmação', d: 'Antes de enviar você revisa lote e valor. Confirmado, o lance não pode ser retirado.' },
        { icon: Zap, t: 'Arremate imediato', d: 'Alguns lotes têm valor de arremate: quem confirmar primeiro leva na hora e o lote fecha.' },
      ]}
    />
  )
}

function FollowStep() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <ul className="space-y-3 text-[15px]">
        <li className="flex gap-2.5"><BellRing aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" /> Avisamos quando alguém passa seu lance e 1 hora antes de encerrar.</li>
        <li className="flex gap-2.5"><Timer aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" /> O leilão dura 24 horas e fecha no horário marcado, sem prorrogação.</li>
        <li className="flex gap-2.5"><CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" /> Classificação: maior valor primeiro; no empate, vale quem registrou antes no servidor.</li>
        <li className="flex gap-2.5"><RefreshCw aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" /> Se o vencedor não pagar, a carta é oferecida ao próximo colocado.</li>
      </ul>
      <TieDemo />
    </div>
  )
}

function PayStep() {
  return (
    <Points
      items={[
        { icon: CheckCircle2, t: 'Pague até segunda, às 18h', d: 'Um pedido por leilão, com PIX ou cartão. Envie o comprovante; a equipe confere e confirma.' },
        { icon: RefreshCw, t: 'Segunda oportunidade', d: 'Sem pagamento no prazo, o próximo colocado recebe a oferta pelo valor do próprio lance, com 24 h para aceitar.' },
        { icon: Truck, t: 'Envio ou retirada', d: 'Correios ou transportadora, ou retirada em Curitiba/PR. O frete é informado pela equipe.' },
        { icon: Warehouse, t: 'Guarde sem custo', d: 'Cartas pagas podem ficar guardadas sem prazo. Junte vários leilões em um envio.' },
      ]}
    />
  )
}

// ---------------------------------------------------------------------
// Educational simulation. Local only: never touches the database.
// ---------------------------------------------------------------------
const PEOPLE = {
  pedro: { name: 'Pedro', color: 'bg-[#e59bd2]', reg: 1, time: '19:42:08', v: 95 },
  joao: { name: 'João', color: 'bg-[#f5c76b]', reg: 2, time: '20:15:31', v: 100 },
  maria: { name: 'Maria', color: 'bg-[#83e6ce]', reg: 3, time: '20:16:02', v: 100 },
}
type Key = keyof typeof PEOPLE
const SIM: { show: Key[]; focus?: Key; out?: Key; offer?: Key; caption: string }[] = [
  { show: ['pedro'], caption: 'Pedro já ofereceu R$ 95,00 (registro #1).' },
  { show: ['pedro', 'joao'], focus: 'joao', caption: 'João oferece R$ 100,00 e assume a liderança.' },
  { show: ['pedro', 'joao', 'maria'], focus: 'maria', caption: 'Maria iguala: também R$ 100,00, registrada depois (#3).' },
  { show: ['pedro', 'joao', 'maria'], focus: 'joao', caption: 'Empate no valor: João continua em 1º porque registrou antes (#2).' },
  { show: ['pedro', 'joao', 'maria'], focus: 'pedro', caption: 'Pedro segue classificado em 3º, como reserva.' },
  { show: ['pedro', 'joao', 'maria'], out: 'joao', offer: 'maria', caption: 'Se João não pagar até segunda às 18h, Maria recebe a oferta pelo lance dela, com 24 h para aceitar.' },
]

function TieDemo() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const s = SIM[step]
  const rows = s.show.map((k) => ({ k, ...PEOPLE[k] })).sort((a, b) => b.v - a.v || a.reg - b.reg)
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold">Simulação de classificação</p>
        <span className="text-[12px] text-subtle">Exemplo educativo · passo {step + 1}/{SIM.length}</span>
      </div>
      <ol className="mt-3 space-y-1.5">
        <AnimatePresence initial={false}>
          {rows.map((r, i) => (
            <motion.li
              key={r.k}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: s.out === r.k ? 0.45 : 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className={cx(
                'grid h-11 grid-cols-[2rem_1.75rem_1fr_auto] items-center gap-2.5 rounded-xl border px-2.5 transition-colors',
                s.focus === r.k || s.offer === r.k ? 'border-accent/45 bg-accent-soft' : 'border-line bg-bg',
              )}
            >
              <span className={cx('tabular text-[14px] font-bold', i === 0 && s.out !== r.k ? 'text-accent-text' : 'text-subtle')}>{i + 1}º</span>
              <span aria-hidden className={cx('grid size-7 place-items-center rounded-full text-[12px] font-bold text-[#0b1218]', r.color)}>{r.name[0]}</span>
              <span className="min-w-0 truncate text-[14px]">
                <span className={cx('font-semibold', s.out === r.k && 'line-through')}>{r.name}</span>
                <span className="tabular ml-1.5 text-[12px] text-subtle">#{r.reg} · {r.time}</span>
                {s.offer === r.k && <span className="ml-1.5 rounded-full bg-gold-soft px-1.5 py-0.5 text-[11px] font-semibold text-gold-text">oferta</span>}
              </span>
              <span className="tabular text-[15px] font-bold">{money(r.v)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <p className="mt-3 min-h-[2.75rem] text-[13.5px] leading-snug text-muted" aria-live="polite">{s.caption}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => setStep((x) => Math.min(SIM.length - 1, x + 1))} disabled={step === SIM.length - 1} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-ink px-3.5 text-[13px] font-semibold text-bg disabled:opacity-35">
          Próximo passo <ArrowRight aria-hidden className="size-3.5" />
        </button>
        <button type="button" onClick={() => setStep(0)} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-[13px] font-semibold hover:border-accent">
          <RotateCcw aria-hidden className="size-3.5" /> Reiniciar
        </button>
      </div>
    </div>
  )
}
