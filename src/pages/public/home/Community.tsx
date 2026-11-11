import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, BadgeCheck, MapPin, MessageCircle, PackageCheck, Users, Warehouse } from 'lucide-react'
import { INSTAGRAM_URL, WHATSAPP_GROUP_URL } from '@/lib/community'

function Instagram({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className={className} aria-hidden>
      <rect x='3' y='3' width='18' height='18' rx='5' />
      <circle cx='12' cy='12' r='4' />
      <circle cx='17.5' cy='6.5' r='0.6' fill='currentColor' />
    </svg>
  )
}

const BENEFITS = [
  { icon: Warehouse, t: 'Armazenamento gratuito', d: 'Cartas pagas ficam guardadas sem prazo e sem taxa. Junte leilões e peça um envio só.' },
  { icon: MapPin, t: 'Retirada em Curitiba', d: 'Busque em eventos, feiras ou no local combinado com a equipe.' },
  { icon: PackageCheck, t: 'Pedidos organizados', d: 'Resumo automático, prazo claro e status em cada etapa até a entrega.' },
  { icon: BadgeCheck, t: 'Confirmação antes do lance', d: 'Todo lance pede revisão. Vale o que o servidor registrou, sem clique acidental.' },
]

export function Community() {
  const reduce = useReducedMotion()
  const reveal = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.5, delay: i * 0.07, ease: [0.2, 0.8, 0.2, 1] as const } })
  return (
    <section aria-labelledby="comm-title" className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 lg:py-20">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
        <motion.div {...reveal(0)} className="flex flex-col">
          <p className="mb-2.5 text-[13px] font-semibold tracking-[0.14em] text-accent-text uppercase">Comunidade</p>
          <h2 id="comm-title" className="text-[clamp(2rem,calc(1.3rem_+_2.4vw),3.1rem)] leading-[1.05]">
            O papo é no grupo.<br />
            <span className="text-accent-text">Os lances, aqui.</span>
          </h2>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-muted">
            O site organiza leilões, pagamentos e entregas. Novidades, conversas e anúncios continuam no grupo oficial do WhatsApp.
          </p>
          <div className="relative mt-7 flex-1 overflow-hidden rounded-[1.75rem] border border-accent/30 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(64_217_208/.16),transparent_55%)] bg-surface p-6 sm:p-7">
            <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(70%_80%_at_100%_100%,black,transparent)]" />
            <div className="relative flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-[#0b1218]">
                <MessageCircle aria-hidden className="size-6" />
              </span>
              <div>
                <p className="text-xl font-semibold">Grupo oficial no WhatsApp</p>
                <p className="mt-1 text-[15px] text-muted">Anúncios dos leilões, sorteios e a comunidade Gimmy Cards em um lugar só.</p>
              </div>
            </div>
            <div className="relative mt-6 flex flex-wrap gap-2.5">
              <a
                href={WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex h-12 items-center gap-2 rounded-[14px] bg-ink px-5 font-semibold text-bg transition-transform hover:-translate-y-0.5 active:scale-[.98]"
              >
                <Users aria-hidden className="size-[18px]" /> Entrar no grupo
                <ArrowUpRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                <span className="sr-only">(abre o WhatsApp em nova aba)</span>
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-[14px] border border-line-strong px-5 font-semibold transition-colors hover:border-accent hover:text-accent-text"
              >
                <Instagram aria-hidden className="size-[18px]" /> @gimmycards
                <span className="sr-only">no Instagram (abre em nova aba)</span>
              </a>
            </div>
          </div>
        </motion.div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:self-end">
          {BENEFITS.map((b, i) => (
            <motion.li
              key={b.t}
              {...reveal(i + 1)}
              className="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-line bg-surface p-6 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-soft"
            >
              <span aria-hidden className="tabular absolute top-4 right-5 text-[44px] leading-none font-bold text-line-strong transition-colors group-hover:text-accent/25">0{i + 1}</span>
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
                <b.icon aria-hidden className="size-[22px]" />
              </span>
              <h3 className="mt-6 text-lg leading-snug">{b.t}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{b.d}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
